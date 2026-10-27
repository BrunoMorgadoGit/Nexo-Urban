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
    const equipmentStatusCounts = Object.fromEntries(
      equipmentStatuses.map((status) => [status, byStatus[status] ?? 0]),
    ) as Record<(typeof equipmentStatuses)[number], number>;
    const availability = calculateAvailability(byStatus);
    const unclassifiedEquipment = Math.max(
      0,
      availability.totalEquipment - Object.values(equipmentStatusCounts).reduce((total, count) => total + count, 0),
    );
    return {
      demoMode: process.env.NODE_ENV === 'development',
      equipmentStatusCounts,
      unclassifiedEquipment,
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
        SELECT effective.region_id AS region_id, COUNT(agent.id)::int AS on_duty
        FROM agents agent
        LEFT JOIN agent_positions position ON position.agent_id = agent.id
        LEFT JOIN equipment linked_equipment ON linked_equipment.id = agent.equipment_id
        LEFT JOIN equipment_positions linked_position ON linked_position.equipment_id = linked_equipment.id
        LEFT JOIN equipment_locations equipment_location ON equipment_location.equipment_id = linked_equipment.id
        LEFT JOIN operational_bases base ON base.id = agent.operational_base_id
        CROSS JOIN LATERAL (
          SELECT CASE
            WHEN position.id IS NOT NULL THEN position.region_id
            WHEN linked_position.id IS NOT NULL THEN equipment_location.region_id
            ELSE base.region_id
          END AS region_id
        ) effective
        WHERE agent.availability = 'on_duty' AND effective.region_id IS NOT NULL
        GROUP BY effective.region_id
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
    const rows = await this.dataSource.query(`
      SELECT attention.* FROM (
        SELECT
          'work_order'::text AS source,
          maintenance.id AS maintenance_id,
          equipment.id AS equipment_id,
          equipment.serial_number,
          type.label AS type_label,
          to_char(maintenance.scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
          maintenance.description,
          maintenance.priority,
          maintenance.status,
          CASE
            WHEN maintenance.scheduled_date < $1 THEN 'overdue'
            WHEN maintenance.priority = 'immediate' OR maintenance.kind = 'immediate' THEN 'immediate'
            ELSE 'upcoming'
          END AS urgency
        FROM maintenances maintenance
        JOIN equipment ON equipment.id = maintenance.equipment_id
        JOIN equipment_types type ON type.code = equipment.type_code
        WHERE maintenance.status IN ('scheduled', 'in_progress')
          AND (maintenance.scheduled_date <= $2 OR maintenance.priority = 'immediate' OR maintenance.kind = 'immediate')

        UNION ALL

        SELECT
          'inventory_schedule'::text AS source,
          NULL::uuid AS maintenance_id,
          equipment.id AS equipment_id,
          equipment.serial_number,
          type.label AS type_label,
          to_char(equipment.next_maintenance_date, 'YYYY-MM-DD') AS scheduled_date,
          'Próxima manutenção registrada no inventário.'::text AS description,
          equipment.maintenance_priority AS priority,
          NULL::varchar AS status,
          CASE
            WHEN equipment.next_maintenance_date < $1 THEN 'overdue'
            WHEN equipment.maintenance_priority = 'immediate' THEN 'immediate'
            ELSE 'upcoming'
          END AS urgency
        FROM equipment
        JOIN equipment_types type ON type.code = equipment.type_code
        WHERE (equipment.next_maintenance_date <= $2 OR equipment.maintenance_priority = 'immediate')
          AND NOT EXISTS (
            SELECT 1 FROM maintenances active
            WHERE active.equipment_id = equipment.id
              AND active.status IN ('scheduled', 'in_progress')
          )
      ) attention
      ORDER BY CASE attention.urgency WHEN 'overdue' THEN 0 WHEN 'immediate' THEN 1 ELSE 2 END,
        attention.scheduled_date ASC NULLS FIRST, attention.serial_number ASC
      LIMIT 12
    `, [today, throughDate]) as Array<{
      source: MaintenanceAttention['source'];
      maintenance_id: string | null;
      equipment_id: string;
      serial_number: string;
      type_label: string;
      scheduled_date: string | null;
      description: string;
      priority: MaintenanceAttention['priority'];
      status: 'scheduled' | 'in_progress' | null;
      urgency: MaintenanceAttention['urgency'];
    }>;
    return rows.map((row) => ({
      source: row.source,
      maintenanceId: row.maintenance_id,
      equipmentId: row.equipment_id,
      serialNumber: row.serial_number,
      typeLabel: row.type_label,
      scheduledDate: row.scheduled_date,
      description: row.description,
      priority: row.priority,
      status: row.status,
      urgency: row.urgency,
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
        categoryCode: null,
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
      .leftJoinAndSelect('agent.position', 'position')
      .leftJoinAndSelect('position.region', 'positionRegion')
      .leftJoinAndSelect('agent.operationalBase', 'operationalBase')
      .leftJoinAndSelect('operationalBase.region', 'baseRegion')
      .leftJoinAndSelect('agent.linkedEquipment', 'linkedEquipment')
      .leftJoinAndSelect('linkedEquipment.type', 'linkedEquipmentType')
      .leftJoinAndSelect('linkedEquipment.lastPosition', 'linkedPosition')
      .leftJoinAndSelect('linkedEquipment.location', 'equipmentLocation')
      .leftJoinAndSelect('equipmentLocation.region', 'equipmentRegion');
    const regionExpression = 'CASE WHEN position.id IS NOT NULL THEN position.regionId WHEN linkedPosition.id IS NOT NULL THEN equipmentLocation.regionId ELSE operationalBase.regionId END';
    const latitudeExpression = 'COALESCE(position.latitude, linkedPosition.latitude, operationalBase.latitude)';
    const longitudeExpression = 'COALESCE(position.longitude, linkedPosition.longitude, operationalBase.longitude)';
    builder.andWhere('(position.id IS NOT NULL OR linkedPosition.id IS NOT NULL OR (operationalBase.latitude IS NOT NULL AND operationalBase.longitude IS NOT NULL))');
    if (status) builder.andWhere('agent.availability = :availability', { availability: status });
    if (query.organizationId) builder.andWhere('agent.organizationId = :organizationId', { organizationId: query.organizationId });
    if (query.regionId) builder.andWhere(`${regionExpression} = :regionId`, { regionId: query.regionId });
    if (query.regionZone) builder.andWhere(`EXISTS (SELECT 1 FROM regions effective_region WHERE effective_region.id = ${regionExpression} AND effective_region.zone = :regionZone)`, { regionZone: query.regionZone });
    this.applyBounds(builder, query, latitudeExpression, longitudeExpression);
    const records = await builder.orderBy('agent.identifier', 'ASC').take(5000).getMany();
    const now = Date.now();
    return records.map((agent) => {
      const equipmentPosition = agent.linkedEquipment?.lastPosition ?? null;
      const usesAgentPosition = Boolean(agent.position);
      const usesEquipmentPosition = !usesAgentPosition && Boolean(equipmentPosition);
      const usesBase = !usesAgentPosition && !usesEquipmentPosition;
      const latitude = agent.position?.latitude ?? equipmentPosition?.latitude ?? agent.operationalBase!.latitude!;
      const longitude = agent.position?.longitude ?? equipmentPosition?.longitude ?? agent.operationalBase!.longitude!;
      const recordedAt = agent.position?.recordedAt ?? equipmentPosition?.recordedAt ?? agent.operationalBase!.updatedAt;
      const region = usesAgentPosition
        ? agent.position?.region
        : usesEquipmentPosition
          ? agent.linkedEquipment?.location?.region
          : agent.operationalBase?.region;
      return {
        id: agent.id,
        kind: 'agent',
        label: agent.name,
        identifier: agent.identifier,
        status: agent.availability,
        typeCode: null,
        categoryCode: agent.category,
        typeLabel: this.agentCategoryLabel(agent.category),
        organizationId: agent.organizationId,
        organizationName: agent.organization.name,
        regionId: usesAgentPosition ? agent.position?.regionId ?? null : usesEquipmentPosition ? agent.linkedEquipment?.location?.regionId ?? null : agent.operationalBase?.regionId ?? null,
        regionName: region?.name ?? null,
        regionZone: region?.zone ?? null,
        locationDescription: usesBase
          ? `Base operacional: ${agent.operationalBase!.name}`
          : usesEquipmentPosition
            ? `Posição do equipamento ${agent.linkedEquipment!.serialNumber}`
            : 'Última posição conhecida do agente',
        linkedEquipmentLabel: agent.linkedEquipment ? `${agent.linkedEquipment.type?.label ?? agent.linkedEquipment.typeCode} · ${agent.linkedEquipment.serialNumber}` : null,
        latitude,
        longitude,
        positionRecordedAt: recordedAt.toISOString(),
        positionSource: usesAgentPosition ? 'last_known' : usesEquipmentPosition ? 'linked_equipment' : 'agent_base',
        positionStale: !usesBase && isPositionStale(recordedAt, now),
        dataOrigin: agent.dataOrigin,
        maintenancePriority: null,
        nextMaintenanceDate: null,
        detailPath: `/agents/${agent.id}`,
      } satisfies MapResourceContract;
    });
  }

  private countAgentsWithoutPosition(query: MonitoringMapQueryDto, status?: string): Promise<number> {
    if (query.regionId || query.regionZone || query.west !== undefined) return Promise.resolve(0);
    const builder = this.dataSource.getRepository(AgentEntity)
      .createQueryBuilder('agent')
      .leftJoin('agent.position', 'position')
      .leftJoin('agent.operationalBase', 'operationalBase')
      .leftJoin('agent.linkedEquipment', 'linkedEquipment')
      .leftJoin('linkedEquipment.lastPosition', 'linkedPosition')
      .where('position.id IS NULL')
      .andWhere('linkedPosition.id IS NULL')
      .andWhere('(operationalBase.latitude IS NULL OR operationalBase.longitude IS NULL)');
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
      military_police_officer: 'Policial militar',
      civil_police_officer: 'Policial civil',
      other: 'Outro',
    } as Record<string, string>)[category] ?? category;
  }
}
