import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  MonitoringAlert,
  MonitoringAlertAction,
  Page,
} from '@fogo/contracts';
import { DataSource, EntityManager, In } from 'typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { MaintenanceEntity } from '../maintenance/maintenance.entity.js';
import { OperationalAlertActionEntity } from './operational-alert-action.entity.js';
import { OperationalAlertEntity } from './operational-alert.entity.js';
import { ListMonitoringAlertsDto } from './dto/list-monitoring-alerts.dto.js';
import { MonitoringWriteService } from './monitoring-write.service.js';

@Injectable()
export class MonitoringAlertsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly monitoringWrite: MonitoringWriteService,
  ) {}

  async list(query: ListMonitoringAlertsDto): Promise<Page<MonitoringAlert>> {
    const builder = this.dataSource.getRepository(OperationalAlertEntity).createQueryBuilder('alert');
    if (query.severity) builder.andWhere('alert.severity = :severity', { severity: query.severity });
    if (query.code) builder.andWhere('alert.code = :code', { code: query.code });
    if (query.resourceId) builder.andWhere('alert.resourceId = :resourceId', { resourceId: query.resourceId });
    if (query.status === 'active') {
      builder.andWhere('alert.status IN (:...statuses)', { statuses: ['open', 'acknowledged'] });
    } else if (query.status) {
      builder.andWhere('alert.status = :status', { status: query.status });
    }
    const [alerts, total] = await builder
      .orderBy("CASE alert.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END", 'ASC')
      .addOrderBy('alert.createdAt', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return {
      items: await this.toContracts(alerts),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async get(id: string): Promise<MonitoringAlert> {
    const alert = await this.dataSource.getRepository(OperationalAlertEntity).findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alerta operacional não encontrado.');
    return (await this.toContracts([alert]))[0];
  }

  async acknowledge(id: string): Promise<MonitoringAlert> {
    const event = await this.dataSource.transaction(async (manager) => {
      const alertRepository = manager.getRepository(OperationalAlertEntity);
      const alert = await alertRepository.findOne({ where: { id } });
      if (!alert) throw new NotFoundException('Alerta operacional não encontrado.');
      if (alert.status === 'resolved') throw new ConflictException('Um alerta encerrado não pode ser reconhecido.');
      if (alert.status === 'acknowledged') return null;

      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date();
      await alertRepository.save(alert);
      await manager.getRepository(OperationalAlertActionEntity).save({
        alertId: id,
        type: 'acknowledged',
        note: null,
        actor: 'Operador local',
      });
      return this.monitoringWrite.appendEvent(manager, {
        eventType: 'alert.updated',
        resourceType: 'alert',
        resourceId: id,
        payload: { action: 'acknowledged', status: alert.status },
        source: 'api',
      });
    });
    if (event) this.monitoringWrite.publish([event]);
    return this.get(id);
  }

  async addNote(id: string, noteValue: string): Promise<MonitoringAlert> {
    const note = noteValue.trim();
    if (!note) throw new ConflictException('A observação não pode estar vazia.');
    const event = await this.dataSource.transaction(async (manager) => {
      const alert = await manager.getRepository(OperationalAlertEntity).findOne({ where: { id } });
      if (!alert) throw new NotFoundException('Alerta operacional não encontrado.');
      await manager.getRepository(OperationalAlertActionEntity).save({
        alertId: id,
        type: 'note',
        note,
        actor: 'Operador local',
      });
      return this.monitoringWrite.appendEvent(manager, {
        eventType: 'alert.updated',
        resourceType: 'alert',
        resourceId: id,
        payload: { action: 'note_added', status: alert.status },
        source: 'api',
      });
    });
    this.monitoringWrite.publish([event]);
    return this.get(id);
  }

  async resolve(id: string): Promise<MonitoringAlert> {
    const event = await this.dataSource.transaction(async (manager) => {
      const alertRepository = manager.getRepository(OperationalAlertEntity);
      const alert = await alertRepository.findOne({ where: { id } });
      if (!alert) throw new NotFoundException('Alerta operacional não encontrado.');
      if (alert.status === 'resolved') return null;
      if (await this.isConditionActive(manager, alert)) {
        throw new ConflictException('Normalize a condição do recurso antes de encerrar este alerta.');
      }
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      await alertRepository.save(alert);
      await manager.getRepository(OperationalAlertActionEntity).save({
        alertId: id,
        type: 'resolved',
        note: 'Encerrado pelo operador após verificação da condição.',
        actor: 'Operador local',
      });
      return this.monitoringWrite.appendEvent(manager, {
        eventType: 'alert.resolved',
        resourceType: 'alert',
        resourceId: id,
        payload: { action: 'resolved', status: alert.status, resolvedAutomatically: false },
        source: 'api',
      });
    });
    if (event) this.monitoringWrite.publish([event]);
    return this.get(id);
  }

  private async isConditionActive(
    manager: EntityManager,
    alert: OperationalAlertEntity,
  ): Promise<boolean> {
    if (alert.resourceType === 'equipment') {
      const equipment = await manager.getRepository(EquipmentEntity).findOne({ where: { id: alert.resourceId } });
      if (!equipment) return false;
      if (alert.code === 'equipment_malfunctioning') return equipment.status === 'malfunctioning';
      if (alert.code === 'equipment_stolen') return equipment.status === 'stolen';
      return equipment.status === 'maintenance' || equipment.status === 'deactivated';
    }
    const maintenance = await manager.getRepository(MaintenanceEntity).findOne({ where: { id: alert.resourceId } });
    if (!maintenance || !['scheduled', 'in_progress'].includes(maintenance.status)) return false;
    if (alert.code === 'maintenance_immediate') {
      return maintenance.priority === 'immediate' || maintenance.kind === 'immediate';
    }
    return maintenance.scheduledDate < new Date().toISOString().slice(0, 10);
  }

  private async toContracts(alerts: OperationalAlertEntity[]): Promise<MonitoringAlert[]> {
    if (!alerts.length) return [];
    const ids = alerts.map(({ id }) => id);
    const equipmentIds = alerts.filter(({ resourceType }) => resourceType === 'equipment').map(({ resourceId }) => resourceId);
    const maintenanceIds = alerts.filter(({ resourceType }) => resourceType === 'maintenance').map(({ resourceId }) => resourceId);
    const [actions, equipment, maintenance] = await Promise.all([
      this.dataSource.getRepository(OperationalAlertActionEntity).find({
        where: { alertId: In(ids) },
        order: { createdAt: 'ASC' },
      }),
      equipmentIds.length
        ? this.dataSource.getRepository(EquipmentEntity).find({ where: { id: In(equipmentIds) }, relations: { organization: true } })
        : Promise.resolve([]),
      maintenanceIds.length
        ? this.dataSource.getRepository(MaintenanceEntity).find({
            where: { id: In(maintenanceIds) },
            relations: { equipment: { organization: true } },
          })
        : Promise.resolve([]),
    ]);
    const equipmentById = new Map(equipment.map((item) => [item.id, item]));
    const maintenanceById = new Map(maintenance.map((item) => [item.id, item]));
    const actionsByAlert = new Map<string, MonitoringAlertAction[]>();
    for (const action of actions) {
      const current = actionsByAlert.get(action.alertId) ?? [];
      current.push({
        id: action.id,
        type: action.type,
        note: action.note,
        actor: action.actor,
        createdAt: action.createdAt.toISOString(),
      });
      actionsByAlert.set(action.alertId, current);
    }

    return alerts.map((alert) => {
      const isEquipment = alert.resourceType === 'equipment';
      const equipmentRecord = isEquipment
        ? equipmentById.get(alert.resourceId)
        : maintenanceById.get(alert.resourceId)?.equipment;
      const resourceLabel = isEquipment
        ? equipmentRecord?.serialNumber ?? 'Equipamento indisponível'
        : `${equipmentRecord?.serialNumber ?? 'Equipamento'} · ${maintenanceById.get(alert.resourceId)?.description ?? 'Manutenção'}`;
      return {
        id: alert.id,
        code: alert.code,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        description: alert.description,
        resourceType: alert.resourceType,
        resourceId: alert.resourceId,
        resourceLabel,
        organizationName: equipmentRecord?.organization.name ?? 'Órgão não disponível',
        createdAt: alert.createdAt.toISOString(),
        updatedAt: alert.updatedAt.toISOString(),
        acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
        resolvedAt: alert.resolvedAt?.toISOString() ?? null,
        actions: actionsByAlert.get(alert.id) ?? [],
        detailPath: equipmentRecord ? `/equipments/${equipmentRecord.id}` : '/alerts',
      };
    });
  }
}
