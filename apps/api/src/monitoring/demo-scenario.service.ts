import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { DemoScenario, DemoTimelineEntry, OperationalEventType } from '@fogo/contracts';
import { DataSource, EntityManager } from 'typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { OperationalAlertEntity } from './operational-alert.entity.js';
import { OperationalEventEntity } from './operational-event.entity.js';
import { MonitoringWriteService } from './monitoring-write.service.js';

const scenarioSerial = 'DEMO-RAD-001';
const initialNextMaintenanceDate = '2026-11-10';

@Injectable()
export class DemoScenarioService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly monitoringWrite: MonitoringWriteService,
  ) {}

  async get(): Promise<DemoScenario> {
    const equipment = await this.findEquipment();
    return this.toContract(equipment);
  }

  async timeline(): Promise<DemoTimelineEntry[]> {
    const equipment = await this.findEquipment();
    const alerts = await this.dataSource.getRepository(OperationalAlertEntity).find({
      where: { resourceType: 'equipment', resourceId: equipment.id },
      select: { id: true },
    });
    const query = this.dataSource.getRepository(OperationalEventEntity).createQueryBuilder('event')
      .where('(event.resourceType IN (:...resourceTypes) AND event.resourceId = :equipmentId)', {
        resourceTypes: ['equipment', 'demo_scenario'], equipmentId: equipment.id,
      });
    if (alerts.length) {
      query.orWhere('(event.resourceType = :alertType AND event.resourceId IN (:...alertIds))', {
        alertType: 'alert', alertIds: alerts.map(({ id }) => id),
      });
    }
    const events = await query.orderBy('event.createdAt', 'DESC').addOrderBy('event.id', 'DESC').take(40).getMany();
    return events.reverse().map((event) => {
      const payload = event.payload;
      const action = typeof payload.action === 'string' ? payload.action : '';
      const status = typeof payload.status === 'string'
        ? payload.status
        : event.eventType === 'alert.created' ? 'open'
          : event.eventType === 'alert.resolved' ? 'resolved'
            : event.eventType === 'equipment.updated' || event.eventType === 'demo.scenario.changed' ? equipment.status : 'recorded';
      return {
        id: event.id,
        occurredAt: event.createdAt.toISOString(),
        serialNumber: equipment.serialNumber,
        eventType: event.eventType as OperationalEventType,
        source: event.source,
        status,
        description: this.describeTimelineEvent(event.eventType, action, payload),
        equipmentId: equipment.id,
      };
    });
  }

  async outage(): Promise<DemoScenario> {
    const events = await this.dataSource.transaction(async (manager) => {
      const equipment = await this.findEquipment(manager);
      if (equipment.status === 'malfunctioning') return [];
      const previousStatus = equipment.status;
      await manager.getRepository(EquipmentEntity).update(equipment.id, {
        status: 'malfunctioning',
        maintenancePriority: 'immediate',
      });
      return this.monitoringWrite.equipmentChanged(manager, equipment.id, previousStatus, 'demo', 'demo.scenario.changed', {
        scenarioCode: 'radar-outage',
        action: 'outage',
      });
    });
    this.monitoringWrite.publish(events);
    return this.get();
  }

  async reset(): Promise<DemoScenario> {
    const events = await this.dataSource.transaction(async (manager) => {
      const equipment = await this.findEquipment(manager);
      if (equipment.status === 'operational' && equipment.maintenancePriority === 'normal' && equipment.nextMaintenanceDate === initialNextMaintenanceDate) return [];
      const previousStatus = equipment.status;
      await manager.getRepository(EquipmentEntity).update(equipment.id, {
        status: 'operational',
        maintenancePriority: 'normal',
        nextMaintenanceDate: initialNextMaintenanceDate,
      });
      return this.monitoringWrite.equipmentChanged(manager, equipment.id, previousStatus, 'demo', 'demo.scenario.changed', {
        scenarioCode: 'radar-outage',
        action: 'reset',
      });
    });
    this.monitoringWrite.publish(events);
    return this.get();
  }

  private async findEquipment(manager?: EntityManager): Promise<EquipmentEntity> {
    const repository = manager?.getRepository(EquipmentEntity) ?? this.dataSource.getRepository(EquipmentEntity);
    const equipment = await repository.findOne({ where: { serialNumber: scenarioSerial } });
    if (!equipment) throw new NotFoundException('Equipamento do cenário demonstrativo não encontrado. Execute o seed oficial.');
    if (equipment.dataOrigin !== 'demo') {
      throw new ConflictException('O equipamento do cenário não está marcado como demonstrativo.');
    }
    return equipment;
  }

  private toContract(equipment: EquipmentEntity): DemoScenario {
    return {
      mode: 'DEMONSTRATION',
      code: 'radar-outage',
      label: 'Indisponibilidade controlada de radar',
      equipmentId: equipment.id,
      serialNumber: equipment.serialNumber,
      status: equipment.status,
      initialStatus: 'operational',
      active: equipment.status === 'malfunctioning',
    };
  }

  private describeTimelineEvent(type: OperationalEventType, action: string, payload: Record<string, unknown>): string {
    if (type === 'demo.scenario.changed') {
      return action === 'outage'
        ? 'Falha demonstrativa aplicada; a condição foi persistida e encaminhada ao monitoramento.'
        : 'Estado operacional restaurado no cenário demonstrativo.';
    }
    if (type === 'alert.created') {
      return `Alerta operacional criado${typeof payload.code === 'string' ? ` (${payload.code.replaceAll('_', ' ')})` : ''}.`;
    }
    if (type === 'alert.updated') {
      return action === 'acknowledged' ? 'Alerta reconhecido pelo operador.'
        : action === 'note_added' ? 'Observação adicionada ao alerta.' : 'Alerta atualizado.';
    }
    if (type === 'alert.resolved') {
      return payload.resolvedAutomatically ? 'Condição normalizada; alerta resolvido automaticamente.' : 'Alerta resolvido pelo operador.';
    }
    if (type === 'equipment.updated') return 'Estado do equipamento atualizado.';
    return `Evento operacional: ${type}.`;
  }
}
