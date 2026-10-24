import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  MaintenanceAttention,
  MapResourceContract,
  MonitoringMapSnapshot,
  MonitoringOverview,
  MonitoringRegionSummary,
} from '@fogo/contracts';
import { agentAvailabilityStates, equipmentStatuses } from '@fogo/contracts';
import { DataSource, In, type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';
import { AgentEntity } from '../agents/agent.entity.js';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { MaintenanceEntity } from '../maintenance/maintenance.entity.js';
import { RegionEntity } from '../regions/region.entity.js';
import { MonitoringMapQueryDto } from './dto/monitoring-map-query.dto.js';
import { OperationalAlertEntity } from './operational-alert.entity.js';
import { calculateAvailability, isPositionStale } from './monitoring-policies.js';
import { addCalendarDays, operationalDateKey } from '../common/operational-date.js';

@Injectable()
export class MonitoringReadService {
  constructor(private readonly dataSource: DataSource) {}

  async overview(): Promise<MonitoringOverview> {
    const today = operationalDateKey();
    const [statusRows, agentsOnDuty, activeCriticalAlerts, overdueMaintenance] = await Promise.all([
      this.dataSource.getRepository(EquipmentEntity)
        .createQueryBuilder('equipment')
        .select('equipment.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('equipment.status')
        .getRawMany<{ status: string; count: string }>(),
      this.dataSource.getRepository(AgentEntity).count({ where: { availability: 'on_duty' } }),
      this.dataSource.getRepository(OperationalAlertEntity).count({
        where: { severity: 'critical', status: In(['open', 'acknowledged']) },
      }),
      this.dataSource.getRepository(MaintenanceEntity)
        .createQueryBuilder('maintenance')
        .where('maintenance.status IN (:...statuses)', { statuses: ['scheduled', 'in_progress'] })
        .andWhere('maintenance.scheduledDate < :today', { today })
        .getCount(),
    ]);

    const byStatus = Object.fromEntries(statusRows.map(({ status, count }) => [status, Number(count)]));
    const availability = calculateAvailability(byStatus);
    return {
      demoMode: process.env.NODE_ENV === 'development',
      ...availability,
      agentsOnDuty,
      activeCriticalAlerts,
      overdueMaintenance,
      calculatedAt: new Date().toISOString(),
    };
  }

  async map(query: MonitoringMapQueryDto): Promise<MonitoringMapSnapshot> {
    this.validateBounds(query);
    const equipmentStatus = query.status && equipmentStatuses.includes(query.status as (typeof equipmentStatuses)[number])
      ? query.status
      : undefined;
    const agentStatus = query.status && agentAvailabilityStates.includes(query.status as (typeof agentAvailabilityStates)[number])
      ? query.status
      : undefined;
    const includeEquipment = query.resourceType !== 'agent' && Boolean(!query.status || equipmentStatus);
    const includeAgents = query.resourceType !== 'equipment' && !query.typeCode && Boolean(!query.status || agentStatus);

    const [equipment, agents, withoutPosition] = await Promise.all([
      includeEquipment ? this.findEquipment(query, equipmentStatus) : Promise.resolve([]),
      includeAgents ? this.findAgents(query, agentStatus) : Promise.resolve([]),
      includeAgents ? this.countAgentsWithoutPosition(query, agentStatus) : Promise.resolve(0),
    ]);
    const items = [...equipment, ...agents].sort((left, right) => left.label.localeCompare(right.label));
    return { demoMode: process.env.NODE_ENV === 'development', items, withoutPosition, generatedAt: new Date().toISOString() };
  }

  async regions(): Promise<MonitoringRegionSummary[]> {
    const [regions, equipmentCounts, agentCounts] = await Promise.all([
      this.dataSource.getRepository(RegionEntity).find({ order: { name: 'ASC' } }),
      this.dataSource.query(`
        SELECT location.region_id AS region_id,
          COUNT(equipment.id)::int AS registered,
          COUNT(equipment.id) FILTER (WHERE equipment.status NOT IN ('not_installed', 'deactivated'))::int AS eligible,
          COUNT(equipment.id) FILTER (WHERE equipment.status = 'operational')::int AS operational,
          COUNT(equipment.id) FILTER (WHERE equipment.status = 'stolen')::int AS stolen
        FROM equipment_locations location
        JOIN equipment ON equipment.id = location.equipment_id
        GROUP BY location.region_id
      `) as Promise<Array<{ region_id: string; registered: number; eligible: number; operational: number; stolen: number }>>,
      this.dataSource.query(`
        SELECT position.region_id AS region_id, COUNT(agent.id)::int AS on_duty
        FROM agent_positions position
        JOIN agents agent ON agent.id = position.agent_id
        WHERE agent.availability = 'on_duty' AND position.region_id IS NOT NULL
        GROUP BY position.region_id
      `) as Promise<Array<{ region_id: string; on_duty: number }>>,
    ]);
    const equipmentByRegion = new Map(equipmentCounts.map((row) => [row.region_id, row]));
    const agentsByRegion = new Map(agentCounts.map((row) => [row.region_id, row.on_duty]));
    return regions.map((region) => {
      const counts = equipmentByRegion.get(region.id);
      const registeredEquipment = Number(counts?.registered ?? 0);
      const eligibleEquipment = Number(counts?.eligible ?? 0);
      const operationalEquipment = Number(counts?.operational ?? 0);
      return {
        id: region.id,
        code: region.code,
        name: region.name,
        zone: region.zone,
        city: region.city,
        state: region.state,
        registeredEquipment,
        eligibleEquipment,
        operationalEquipment,
        unavailableEquipment: Math.max(0, eligibleEquipment - operationalEquipment),
        stolenEquipment: Number(counts?.stolen ?? 0),
        agentsOnDuty: agentsByRegion.get(region.id) ?? 0,
        availabilityPercent: this.percent(operationalEquipment, eligibleEquipment),
      };
    });
  }

  async maintenanceAlerts(): Promise<MaintenanceAttention[]> {
    const today = operationalDateKey();
    const throughDate = addCalendarDays(today, 7);
    const rows = await this.dataSource.getRepository(MaintenanceEntity)
      .createQueryBuilder('maintenance')
      .innerJoinAndSelect('maintenance.equipment', 'equipment')
      .innerJoinAndSelect('equipment.type', 'type')
      .where('maintenance.status IN (:...statuses)', { statuses: ['scheduled', 'in_progress'] })
      .andWhere('(maintenance.scheduledDate <= :throughDate OR maintenance.priority = \'immediate\')', { throughDate })
      .orderBy('maintenance.scheduledDate', 'ASC')
      .take(12)
      .getMany();
    return rows.map((maintenance) => ({
      maintenance: {
        id: maintenance.id,
        equipmentId: maintenance.equipmentId,
        serialNumber: maintenance.equipment.serialNumber,
        typeLabel: maintenance.equipment.type.label,
        kind: maintenance.kind,
        status: maintenance.status,
        priority: maintenance.priority,
        description: maintenance.description,
        scheduledDate: maintenance.scheduledDate,
        completedAt: maintenance.completedAt?.toISOString() ?? null,
        overdue: maintenance.scheduledDate < today,
        createdAt: maintenance.createdAt.toISOString(),
      },
      urgency: maintenance.scheduledDate < today
        ? 'overdue'
        : maintenance.priority === 'immediate' || maintenance.kind === 'immediate'
          ? 'immediate'
          : 'upcoming',
    }));
  }

  private async findEquipment(query: MonitoringMapQueryDto, status?: string): Promise<MapResourceContract[]> {
    const builder = this.dataSource.getRepository(EquipmentEntity)
      .createQueryBuilder('equipment')
      .innerJoinAndSelect('equipment.type', 'type')
      .innerJoinAndSelect('equipment.organization', 'organization')
      .innerJoinAndSelect('equipment.location', 'location')
      .innerJoinAndSelect('location.region', 'region')
      .leftJoinAndSelect('equipment.lastPosition', 'position');
    if (query.typeCode) builder.andWhere('equipment.typeCode = :typeCode', { typeCode: query.typeCode });
    if (status) builder.andWhere('equipment.status = :status', { status });
    if (query.organizationId) builder.andWhere('equipment.organizationId = :organizationId', { organizationId: query.organizationId });
    if (query.regionId) builder.andWhere('location.regionId = :regionId', { regionId: query.regionId });
    if (query.regionZone) builder.andWhere('region.zone = :regionZone', { regionZone: query.regionZone });
    this.applyBounds(builder, query, 'COALESCE(position.latitude, location.latitude)', 'COALESCE(position.longitude, location.longitude)');
    const records = await builder.orderBy('equipment.serialNumber', 'ASC').take(5000).getMany();
    const now = Date.now();
    return records.map((equipment) => {
      const usesLastPosition = equipment.type.mobility === 'mobile' && Boolean(equipment.lastPosition);
      const latitude = usesLastPosition ? equipment.lastPosition!.latitude : equipment.location.latitude;
      const longitude = usesLastPosition ? equipment.lastPosition!.longitude : equipment.location.longitude;
      const recordedAt = usesLastPosition ? equipment.lastPosition!.recordedAt : equipment.location.updatedAt;
      return {
        id: equipment.id,
        kind: 'equipment',
        label: `${equipment.brand} ${equipment.model}`,
        identifier: equipment.serialNumber,
        status: equipment.status,
        typeCode: equipment.type.code,
        typeLabel: equipment.type.label,
        organizationId: equipment.organizationId,
        organizationName: equipment.organization.name,
        regionId: equipment.location.regionId,
        regionName: equipment.location.region.name,
        regionZone: equipment.location.region.zone,
        locationDescription: [equipment.location.street, equipment.location.reference, equipment.location.postalCode]
          .filter(Boolean).join(' · '),
        latitude,
        longitude,
        positionRecordedAt: recordedAt.toISOString(),
        positionSource: usesLastPosition ? 'last_known' : equipment.location.role === 'base' ? 'operational_base' : 'fixed_location',
        positionStale: usesLastPosition && isPositionStale(recordedAt, now),
        dataOrigin: equipment.dataOrigin,
        maintenancePriority: equipment.maintenancePriority,
        nextMaintenanceDate: equipment.nextMaintenanceDate,
        detailPath: `/equipments/${equipment.id}`,
      } satisfies MapResourceContract;
    });
  }

  private async findAgents(query: MonitoringMapQueryDto, status?: string): Promise<MapResourceContract[]> {
    const builder = this.dataSource.getRepository(AgentEntity)
      .createQueryBuilder('agent')
      .innerJoinAndSelect('agent.organization', 'organization')
      .innerJoinAndSelect('agent.position', 'position')
      .leftJoinAndSelect('position.region', 'region');
    if (status) builder.andWhere('agent.availability = :availability', { availability: status });
    if (query.organizationId) builder.andWhere('agent.organizationId = :organizationId', { organizationId: query.organizationId });
    if (query.regionId) builder.andWhere('position.regionId = :regionId', { regionId: query.regionId });
    if (query.regionZone) builder.andWhere('region.zone = :regionZone', { regionZone: query.regionZone });
    this.applyBounds(builder, query, 'position.latitude', 'position.longitude');
    const records = await builder.orderBy('agent.identifier', 'ASC').take(5000).getMany();
    const now = Date.now();
    return records.map((agent) => ({
      id: agent.id,
      kind: 'agent',
      label: agent.name,
      identifier: agent.identifier,
      status: agent.availability,
      typeCode: null,
      typeLabel: this.agentCategoryLabel(agent.category),
      organizationId: agent.organizationId,
      organizationName: agent.organization.name,
      regionId: agent.position?.regionId ?? null,
      regionName: agent.position?.region?.name ?? null,
      regionZone: agent.position?.region?.zone ?? null,
      locationDescription: null,
      latitude: agent.position!.latitude,
      longitude: agent.position!.longitude,
      positionRecordedAt: agent.position!.recordedAt.toISOString(),
      positionSource: 'last_known',
      positionStale: isPositionStale(agent.position!.recordedAt, now),
      dataOrigin: agent.dataOrigin,
      maintenancePriority: null,
      nextMaintenanceDate: null,
      detailPath: `/agents/${agent.id}`,
    } satisfies MapResourceContract));
  }

  private countAgentsWithoutPosition(query: MonitoringMapQueryDto, status?: string): Promise<number> {
    if (query.regionId || query.regionZone || query.west !== undefined) return Promise.resolve(0);
    const builder = this.dataSource.getRepository(AgentEntity)
      .createQueryBuilder('agent')
      .leftJoin('agent.position', 'position')
      .where('position.id IS NULL');
    if (status) builder.andWhere('agent.availability = :availability', { availability: status });
    if (query.organizationId) builder.andWhere('agent.organizationId = :organizationId', { organizationId: query.organizationId });
    return builder.getCount();
  }

  private applyBounds<T extends ObjectLiteral>(
    builder: SelectQueryBuilder<T>,
    query: MonitoringMapQueryDto,
    latitudeColumn: string,
    longitudeColumn: string,
  ): void {
    if (query.west === undefined) return;
    builder.andWhere(`${longitudeColumn} BETWEEN :west AND :east`, { west: query.west, east: query.east });
    builder.andWhere(`${latitudeColumn} BETWEEN :south AND :north`, { south: query.south, north: query.north });
  }

  private validateBounds(query: MonitoringMapQueryDto): void {
    const values = [query.west, query.south, query.east, query.north];
    if (values.every((value) => value === undefined)) return;
    if (values.some((value) => value === undefined)) {
      throw new BadRequestException('Informe os quatro limites geográficos do mapa.');
    }
    if (query.west! > query.east! || query.south! > query.north!) {
      throw new BadRequestException('Os limites geográficos do mapa são inválidos.');
    }
  }

  private percent(numerator: number, denominator: number): number {
    return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;
  }

  private agentCategoryLabel(category: AgentEntity['category']): string {
    return ({
      traffic_agent: 'Agente de trânsito',
      municipal_guard: 'Guarda municipal',
      police_officer: 'Policial',
    })[category];
  }
}
