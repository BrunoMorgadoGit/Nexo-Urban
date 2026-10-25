import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { OperationalEvent, OperationalEventType } from '@fogo/contracts';
import { DataSource, EntityManager } from 'typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { MaintenanceEntity } from '../maintenance/maintenance.entity.js';
import { AgentEntity } from '../agents/agent.entity.js';
import { OperationalAlertActionEntity } from './operational-alert-action.entity.js';
import { OperationalAlertEntity } from './operational-alert.entity.js';
import { OperationalEventEntity } from './operational-event.entity.js';
import { operationalDateKey } from '../common/operational-date.js';

type ChangeContext = {
  eventType: OperationalEventType;
  source: 'api' | 'demo';
  resourceType: OperationalEventEntity['resourceType'];
  resourceId: string;
  payload: Record<string, unknown>;
};

type AlertCondition = {
  fingerprint: string;
  code: OperationalAlertEntity['code'];
  severity: OperationalAlertEntity['severity'];
  title: string;
  description: string;
  resourceType: OperationalAlertEntity['resourceType'];
  resourceId: string;
};

@Injectable()
export class MonitoringWriteService implements OnApplicationBootstrap {
  private readonly liveEvents = new Subject<OperationalEvent>();
  readonly events$ = this.liveEvents.asObservable();

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const ids = await this.dataSource.getRepository(EquipmentEntity).find({ select: { id: true } });
    for (const { id } of ids) {
      const events = await this.dataSource.transaction((manager) => this.reconcileEquipment(manager, id));
      this.publish(events);
    }
  }

  async equipmentChanged(
    manager: EntityManager,
    equipmentId: string,
    previousStatus: EquipmentEntity['status'] | null,
    source: 'api' | 'demo' = 'api',
    eventType: OperationalEventType = 'equipment.updated',
    extraPayload: Record<string, unknown> = {},
  ): Promise<OperationalEventEntity[]> {
    return this.reconcileEquipment(manager, equipmentId, {
      eventType,
      source,
      resourceType: eventType === 'demo.scenario.changed' ? 'demo_scenario' : 'equipment',
      resourceId: equipmentId,
      payload: { previousStatus, ...extraPayload },
    });
  }

  async agentChanged(manager: EntityManager, agentId: string): Promise<OperationalEventEntity[]> {
    const agent = await manager.getRepository(AgentEntity).findOne({ where: { id: agentId } });
    if (!agent) return [];
    return [await this.appendEvent(manager, {
      eventType: 'agent.updated',
      resourceType: 'agent',
      resourceId: agent.id,
      payload: { availability: agent.availability, dataOrigin: agent.dataOrigin },
      source: 'api',
    })];
  }

  async agentDeleted(manager: EntityManager, agentId: string, identifier: string): Promise<OperationalEventEntity> {
    return this.appendEvent(manager, {
      eventType: 'agent.deleted',
      resourceType: 'agent',
      resourceId: agentId,
      payload: { identifier },
      source: 'api',
    });
  }

  async maintenanceChanged(
    manager: EntityManager,
    maintenanceId: string,
    eventType: 'maintenance.created' | 'maintenance.updated',
    payload: Record<string, unknown>,
  ): Promise<OperationalEventEntity[]> {
    const maintenance = await manager.getRepository(MaintenanceEntity).findOne({ where: { id: maintenanceId } });
    if (!maintenance) return [];
    return this.reconcileEquipment(manager, maintenance.equipmentId, {
      eventType,
      source: 'api',
      resourceType: 'maintenance',
      resourceId: maintenance.id,
      payload,
    });
  }

  private async reconcileEquipment(
    manager: EntityManager,
    equipmentId: string,
    context?: ChangeContext,
  ): Promise<OperationalEventEntity[]> {
    const equipment = await manager.getRepository(EquipmentEntity).findOne({ where: { id: equipmentId } });
    if (!equipment) return [];

    const maintenanceRecords = await manager.getRepository(MaintenanceEntity).find({ where: { equipmentId } });
    const conditions = this.conditionsFor(equipment, maintenanceRecords);
    const prefix = `equipment:${equipmentId}:`;
    const alertRepository = manager.getRepository(OperationalAlertEntity);
    const activeAlerts = await alertRepository.createQueryBuilder('alert')
      .where('alert.fingerprint LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('alert.resolvedAt IS NULL')
      .getMany();
    const existing = new Map(activeAlerts.map((alert) => [alert.fingerprint, alert]));
    const events: OperationalEventEntity[] = [];
    const createdAlertIds: string[] = [];
    const resolvedAlertIds: string[] = [];

    for (const condition of conditions) {
      if (existing.has(condition.fingerprint)) continue;
      const result = await alertRepository.createQueryBuilder()
        .insert()
        .values({ ...condition, status: 'open', acknowledgedAt: null, resolvedAt: null })
        .orIgnore()
        .returning(['id'])
        .execute();
      const insertedId = result.raw[0]?.id as string | undefined;
      if (!insertedId) continue;

      await manager.getRepository(OperationalAlertActionEntity).save({
        alertId: insertedId,
        type: 'created',
        note: 'Condição operacional detectada automaticamente.',
        actor: 'Monitoramento automático',
      });
      createdAlertIds.push(insertedId);
      events.push(await this.appendEvent(manager, {
        eventType: 'alert.created',
        resourceType: 'alert',
        resourceId: insertedId,
        payload: { code: condition.code, severity: condition.severity, resourceId: condition.resourceId },
        source: context?.source ?? 'api',
      }));
    }

    const desiredFingerprints = new Set(conditions.map(({ fingerprint }) => fingerprint));
    for (const alert of activeAlerts) {
      if (desiredFingerprints.has(alert.fingerprint)) continue;
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      await alertRepository.save(alert);
      await manager.getRepository(OperationalAlertActionEntity).save({
        alertId: alert.id,
        type: 'resolved',
        note: 'Condição normalizada; ocorrência encerrada automaticamente.',
        actor: 'Monitoramento automático',
      });
      resolvedAlertIds.push(alert.id);
      events.push(await this.appendEvent(manager, {
        eventType: 'alert.resolved',
        resourceType: 'alert',
        resourceId: alert.id,
        payload: { code: alert.code, resourceId: alert.resourceId, resolvedAutomatically: true },
        source: context?.source ?? 'api',
      }));
    }

    if (context) {
      events.push(await this.appendEvent(manager, {
        ...context,
        payload: {
          ...context.payload,
          status: equipment.status,
          alertsCreated: createdAlertIds,
          alertsResolved: resolvedAlertIds,
        },
      }));
    }
    return events;
  }

  private conditionsFor(
    equipment: EquipmentEntity,
    maintenanceRecords: MaintenanceEntity[],
  ): AlertCondition[] {
    const prefix = `equipment:${equipment.id}:`;
    const conditions: AlertCondition[] = [];
    if (equipment.status === 'malfunctioning') {
      conditions.push({
        fingerprint: `${prefix}malfunctioning`,
        code: 'equipment_malfunctioning',
        severity: 'critical',
        title: 'Equipamento com mau funcionamento',
        description: `${equipment.serialNumber} requer avaliação operacional.`,
        resourceType: 'equipment',
        resourceId: equipment.id,
      });
    } else if (equipment.status === 'stolen') {
      conditions.push({
        fingerprint: `${prefix}stolen`,
        code: 'equipment_stolen',
        severity: 'critical',
        title: 'Equipamento marcado como furtado',
        description: `${equipment.serialNumber} foi marcado como furtado e permanece indisponível.`,
        resourceType: 'equipment',
        resourceId: equipment.id,
      });
    } else if (equipment.status === 'maintenance') {
      conditions.push({
        fingerprint: `${prefix}maintenance`,
        code: 'equipment_unavailable',
        severity: 'high',
        title: 'Equipamento indisponível para manutenção',
        description: `${equipment.serialNumber} está fora de operação durante a manutenção.`,
        resourceType: 'equipment',
        resourceId: equipment.id,
      });
    } else if (equipment.status === 'deactivated') {
      conditions.push({
        fingerprint: `${prefix}deactivated`,
        code: 'equipment_unavailable',
        severity: 'medium',
        title: 'Equipamento desativado',
        description: `${equipment.serialNumber} foi desativado e requer acompanhamento operacional.`,
        resourceType: 'equipment',
        resourceId: equipment.id,
      });
    }

    const today = operationalDateKey();
    for (const maintenance of maintenanceRecords) {
      if (!['scheduled', 'in_progress'].includes(maintenance.status)) continue;
      const maintenancePrefix = `${prefix}maintenance:${maintenance.id}:`;
      if (maintenance.priority === 'immediate' || maintenance.kind === 'immediate') {
        conditions.push({
          fingerprint: `${maintenancePrefix}immediate`,
          code: 'maintenance_immediate',
          severity: 'high',
          title: 'Manutenção urgente registrada',
          description: `${equipment.serialNumber}: ${maintenance.description}`,
          resourceType: 'maintenance',
          resourceId: maintenance.id,
        });
      }
      if (maintenance.scheduledDate < today) {
        conditions.push({
          fingerprint: `${maintenancePrefix}overdue`,
          code: 'maintenance_overdue',
          severity: 'high',
          title: 'Manutenção ultrapassou a data prevista',
          description: `${equipment.serialNumber}: serviço previsto para ${maintenance.scheduledDate}.`,
          resourceType: 'maintenance',
          resourceId: maintenance.id,
        });
      }
    }
    return conditions;
  }

  appendEvent(
    manager: EntityManager,
    values: Pick<OperationalEventEntity, 'eventType' | 'resourceType' | 'resourceId' | 'payload' | 'source'>,
  ): Promise<OperationalEventEntity> {
    return manager.getRepository(OperationalEventEntity).save(
      manager.getRepository(OperationalEventEntity).create(values),
    );
  }

  publish(events: OperationalEventEntity[]): void {
    for (const event of events) {
      this.liveEvents.next({
        id: String(event.id),
        type: event.eventType,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        source: event.source,
        payload: event.payload,
        occurredAt: event.createdAt.toISOString(),
      });
    }
  }
}
