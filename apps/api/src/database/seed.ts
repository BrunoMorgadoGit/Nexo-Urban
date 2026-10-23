import { equipmentTypeDefinitions } from '../equipment-types/equipment-characteristics.js';
import { AgentEntity } from '../agents/agent.entity.js';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { AgentPositionEntity } from '../locations/agent-position.entity.js';
import { EquipmentLocationEntity } from '../locations/equipment-location.entity.js';
import { EquipmentPositionEntity } from '../locations/equipment-position.entity.js';
import { MaintenanceEntity } from '../maintenance/maintenance.entity.js';
import { OrganizationEntity } from '../organizations/organization.entity.js';
import { RegionEntity } from '../regions/region.entity.js';
import { EquipmentTypeEntity } from '../equipment-types/equipment-type.entity.js';
import dataSource from './data-source.js';

const organizations = [
  { code: 'mobilidade-demo', name: 'Secretaria Demonstrativa de Mobilidade' },
  { code: 'servicos-demo', name: 'Secretaria Demonstrativa de Serviços Urbanos' },
  { code: 'guarda-demo', name: 'Guarda Municipal Demonstrativa' },
  { code: 'policiamento-demo', name: 'Policiamento Demonstrativo' },
];

const regions = [
  { code: 'centro', name: 'Centro', zone: 'Central', latitude: -22.9056, longitude: -47.0608 },
  { code: 'cambui', name: 'Cambuí', zone: 'Central', latitude: -22.8948, longitude: -47.0547 },
  { code: 'taquaral', name: 'Taquaral', zone: 'Norte', latitude: -22.8795, longitude: -47.0415 },
  { code: 'barao-geraldo', name: 'Barão Geraldo', zone: 'Norte', latitude: -22.8269, longitude: -47.0779 },
  { code: 'chapadao', name: 'Jardim Chapadão', zone: 'Noroeste', latitude: -22.8861, longitude: -47.0832 },
  { code: 'ouro-verde', name: 'Ouro Verde', zone: 'Sudoeste', latitude: -22.9662, longitude: -47.1130 },
  { code: 'sousas', name: 'Sousas', zone: 'Leste', latitude: -22.8824, longitude: -46.9590 },
  { code: 'santo-antonio', name: 'Jardim Santo Antônio', zone: 'Sul', latitude: -22.9490, longitude: -47.0860 },
];

type EquipmentSeed = {
  serialNumber: string;
  typeCode: string;
  brand: string;
  model: string;
  organizationCode: string;
  status: EquipmentEntity['status'];
  maintenancePriority: EquipmentEntity['maintenancePriority'];
  nextMaintenanceDate: string | null;
  characteristics: Record<string, string | number | boolean>;
  regionCode: string;
  offset: number;
  street: string;
  reference: string;
  lastPosition?: { latitude: number; longitude: number; minutesAgo: number };
};

const equipment: EquipmentSeed[] = [
  {
    serialNumber: 'DEMO-RAD-001', typeCode: 'speed_radar', brand: 'Vértice', model: 'Flux 4',
    organizationCode: 'mobilidade-demo', status: 'operational', maintenancePriority: 'normal',
    nextMaintenanceDate: '2026-11-10', characteristics: { speedLimitKmh: 50, lanes: 3, technology: 'doppler' },
    regionCode: 'centro', offset: 0, street: 'Avenida Demonstrativa', reference: 'altura 120',
  },
  {
    serialNumber: 'DEMO-CAM-001', typeCode: 'surveillance_camera', brand: 'Olho Urbano', model: 'Sentinela 2K',
    organizationCode: 'servicos-demo', status: 'operational', maintenancePriority: 'low',
    nextMaintenanceDate: '2026-12-03', characteristics: { resolution: '2k', nightVision: true, panTiltZoom: true },
    regionCode: 'cambui', offset: 1, street: 'Rua Modelo', reference: 'praça central',
  },
  {
    serialNumber: 'DEMO-BAL-001', typeCode: 'weighbridge', brand: 'Peso Certo', model: 'Rodovia 80',
    organizationCode: 'mobilidade-demo', status: 'malfunctioning', maintenancePriority: 'immediate',
    nextMaintenanceDate: '2026-10-18', characteristics: { maxWeightKg: 80000, precisionKg: 5 },
    regionCode: 'ouro-verde', offset: 2, street: 'Estrada Municipal Fictícia', reference: 'base de fiscalização',
  },
  {
    serialNumber: 'DEMO-FIS-001', typeCode: 'enforcement_vehicle', brand: 'Mobilis', model: 'Urbana',
    organizationCode: 'mobilidade-demo', status: 'operational', maintenancePriority: 'high',
    nextMaintenanceDate: '2026-10-28', characteristics: { vehicleClass: 'pickup', plate: 'FGO1A26', radioCode: 'MOB-01' },
    regionCode: 'taquaral', offset: 3, street: 'Rua da Base Demonstrativa', reference: 'garagem norte',
    lastPosition: { latitude: -22.8768, longitude: -47.0431, minutesAgo: 8 },
  },
  {
    serialNumber: 'DEMO-CAN-001', typeCode: 'access_barrier', brand: 'Acesso Seguro', model: 'Barreira 3',
    organizationCode: 'servicos-demo', status: 'not_installed', maintenancePriority: 'low',
    nextMaintenanceDate: null, characteristics: { laneCount: 2, maxOpeningSeconds: 8, accessMode: 'tag' },
    regionCode: 'barao-geraldo', offset: 4, street: 'Avenida do Campus Demonstrativo', reference: 'acesso leste',
  },
  {
    serialNumber: 'DEMO-TRN-001', typeCode: 'transit_vehicle', brand: 'Via Cidade', model: 'Circular 12',
    organizationCode: 'mobilidade-demo', status: 'operational', maintenancePriority: 'normal',
    nextMaintenanceDate: '2026-11-02', characteristics: { vehicleClass: 'bus', passengerCapacity: 48, accessible: true },
    regionCode: 'centro', offset: 5, street: 'Terminal Demonstrativo', reference: 'plataforma 4',
    lastPosition: { latitude: -22.9087, longitude: -47.0582, minutesAgo: 3 },
  },
  {
    serialNumber: 'DEMO-TOT-001', typeCode: 'service_kiosk', brand: 'Cidadão Digital', model: 'Atende 9',
    organizationCode: 'servicos-demo', status: 'maintenance', maintenancePriority: 'high',
    nextMaintenanceDate: '2026-10-25', characteristics: { screenInches: 21, network: 'ethernet' },
    regionCode: 'chapadao', offset: 6, street: 'Praça de Serviços', reference: 'ao lado da biblioteca',
  },
  {
    serialNumber: 'DEMO-PAT-001', typeCode: 'scooter', brand: 'Rota Leve', model: 'E-Urban',
    organizationCode: 'mobilidade-demo', status: 'operational', maintenancePriority: 'normal',
    nextMaintenanceDate: '2026-11-15', characteristics: { batteryCapacityWh: 480, topSpeedKmh: 25 },
    regionCode: 'cambui', offset: 7, street: 'Avenida do Parque', reference: 'estação compartilhada 08',
    lastPosition: { latitude: -22.8970, longitude: -47.0524, minutesAgo: 12 },
  },
  {
    serialNumber: 'DEMO-MOT-001', typeCode: 'motorcycle', brand: 'Ronda', model: 'Patrulha 300',
    organizationCode: 'guarda-demo', status: 'maintenance', maintenancePriority: 'high',
    nextMaintenanceDate: '2026-10-22', characteristics: { engineCapacityCc: 300, plate: 'FGO2B26', radioCode: 'GCM-03' },
    regionCode: 'santo-antonio', offset: 8, street: 'Rua da Unidade Demonstrativa', reference: 'base sul',
    lastPosition: { latitude: -22.9521, longitude: -47.0836, minutesAgo: 90 },
  },
  {
    serialNumber: 'DEMO-VIA-001', typeCode: 'patrol_vehicle', brand: 'Guarda Urbana', model: 'Proteção 4x4',
    organizationCode: 'guarda-demo', status: 'operational', maintenancePriority: 'normal',
    nextMaintenanceDate: '2026-11-30', characteristics: { vehicleClass: 'van', plate: 'FGO3C26', radioCode: 'GCM-11' },
    regionCode: 'sousas', offset: 9, street: 'Alameda da Unidade', reference: 'base leste',
    lastPosition: { latitude: -22.8806, longitude: -46.9608, minutesAgo: 5 },
  },
  {
    serialNumber: 'DEMO-CAM-002', typeCode: 'surveillance_camera', brand: 'Olho Urbano', model: 'Sentinela 1080',
    organizationCode: 'servicos-demo', status: 'deactivated', maintenancePriority: 'low',
    nextMaintenanceDate: null, characteristics: { resolution: '1080p', nightVision: false, panTiltZoom: false },
    regionCode: 'taquaral', offset: 10, street: 'Ciclovia Demonstrativa', reference: 'poste 14',
  },
  {
    serialNumber: 'DEMO-PAT-002', typeCode: 'scooter', brand: 'Rota Leve', model: 'E-Urban',
    organizationCode: 'mobilidade-demo', status: 'stolen', maintenancePriority: 'immediate',
    nextMaintenanceDate: null, characteristics: { batteryCapacityWh: 420, topSpeedKmh: 25 },
    regionCode: 'ouro-verde', offset: 11, street: 'Praça do Terminal', reference: 'estação compartilhada 12',
    lastPosition: { latitude: -22.9680, longitude: -47.1112, minutesAgo: 720 },
  },
];

const agents = [
  { identifier: 'DEMO-TRF-001', name: 'Agente Demonstração 01', category: 'traffic_agent' as const, organizationCode: 'mobilidade-demo', availability: 'on_duty' as const, regionCode: 'centro', offset: 0 },
  { identifier: 'DEMO-TRF-002', name: 'Agente Demonstração 02', category: 'traffic_agent' as const, organizationCode: 'mobilidade-demo', availability: 'available' as const, regionCode: 'taquaral', offset: 1 },
  { identifier: 'DEMO-TRF-003', name: 'Agente Demonstração 03', category: 'traffic_agent' as const, organizationCode: 'mobilidade-demo', availability: 'off_duty' as const, regionCode: 'ouro-verde', offset: 2 },
  { identifier: 'DEMO-GCM-001', name: 'Guarda Demonstração 01', category: 'municipal_guard' as const, organizationCode: 'guarda-demo', availability: 'on_duty' as const, regionCode: 'cambui', offset: 3 },
  { identifier: 'DEMO-GCM-002', name: 'Guarda Demonstração 02', category: 'municipal_guard' as const, organizationCode: 'guarda-demo', availability: 'available' as const, regionCode: 'sousas', offset: 4 },
  { identifier: 'DEMO-GCM-003', name: 'Guarda Demonstração 03', category: 'municipal_guard' as const, organizationCode: 'guarda-demo', availability: 'unavailable' as const, regionCode: 'chapadao', offset: 5 },
  { identifier: 'DEMO-SEG-001', name: 'Policial Demonstração 01', category: 'police_officer' as const, organizationCode: 'policiamento-demo', availability: 'on_duty' as const, regionCode: 'santo-antonio', offset: 6 },
  { identifier: 'DEMO-SEG-002', name: 'Policial Demonstração 02', category: 'police_officer' as const, organizationCode: 'policiamento-demo', availability: 'available' as const, regionCode: 'barao-geraldo', offset: 7 },
];

const maintenanceRecords = [
  { id: '4dc28e35-31bb-46d7-b18c-e902dc7d0001', serialNumber: 'DEMO-BAL-001', kind: 'immediate' as const, status: 'scheduled' as const, priority: 'immediate' as const, description: 'Calibração e inspeção de sensores do equipamento demonstrativo.', scheduledDate: '2026-10-18' },
  { id: '4dc28e35-31bb-46d7-b18c-e902dc7d0002', serialNumber: 'DEMO-TOT-001', kind: 'scheduled' as const, status: 'in_progress' as const, priority: 'high' as const, description: 'Substituição preventiva de componente eletrônico demonstrativo.', scheduledDate: '2026-10-25' },
  { id: '4dc28e35-31bb-46d7-b18c-e902dc7d0003', serialNumber: 'DEMO-FIS-001', kind: 'periodic' as const, status: 'scheduled' as const, priority: 'normal' as const, description: 'Revisão programada do veículo de fiscalização demonstrativo.', scheduledDate: '2026-10-28' },
  { id: '4dc28e35-31bb-46d7-b18c-e902dc7d0004', serialNumber: 'DEMO-MOT-001', kind: 'scheduled' as const, status: 'completed' as const, priority: 'high' as const, description: 'Revisão de segurança do veículo demonstrativo concluída.', scheduledDate: '2026-10-20', completedAt: new Date('2026-10-20T15:00:00.000Z') },
];

async function seed(): Promise<void> {
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const organizationsRepository = manager.getRepository(OrganizationEntity);
      for (const organization of organizations) {
        await organizationsRepository.upsert({ ...organization, isActive: true }, ['code']);
      }
      const organizationIds = new Map(
        (await organizationsRepository.find()).map((organization) => [organization.code, organization.id]),
      );

      const regionsRepository = manager.getRepository(RegionEntity);
      for (const region of regions) {
        await regionsRepository.upsert(
          { ...region, city: 'Campinas', state: 'SP' },
          ['code'],
        );
      }
      const regionIds = new Map(
        (await regionsRepository.find()).map((region) => [region.code, region.id]),
      );

      const typeRepository = manager.getRepository(EquipmentTypeEntity);
      for (const type of equipmentTypeDefinitions) {
        await typeRepository.upsert(
          {
            code: type.code,
            label: type.label,
            mobility: type.mobility,
            characteristics: type.characteristics,
          },
          ['code'],
        );
      }

      const equipmentRepository = manager.getRepository(EquipmentEntity);
      const locationRepository = manager.getRepository(EquipmentLocationEntity);
      const positionRepository = manager.getRepository(EquipmentPositionEntity);
      const equipmentIds = new Map<string, string>();
      for (const item of equipment) {
        const organizationId = organizationIds.get(item.organizationCode);
        const regionId = regionIds.get(item.regionCode);
        const type = equipmentTypeDefinitions.find(({ code }) => code === item.typeCode);
        if (!organizationId || !regionId || !type) throw new Error('Seed references are incomplete.');
        await equipmentRepository.upsert(
          {
            typeCode: item.typeCode,
            serialNumber: item.serialNumber,
            brand: item.brand,
            model: item.model,
            organizationId,
            status: item.status,
            maintenancePriority: item.maintenancePriority,
            nextMaintenanceDate: item.nextMaintenanceDate,
            characteristics: item.characteristics,
          },
          ['serialNumber'],
        );
        const persisted = await equipmentRepository.findOneByOrFail({ serialNumber: item.serialNumber });
        equipmentIds.set(item.serialNumber, persisted.id);
        const region = regions.find(({ code }) => code === item.regionCode);
        if (!region) throw new Error('Seed region definition is incomplete.');
        await locationRepository.upsert(
          {
            equipmentId: persisted.id,
            postalCode: '13000-000',
            street: item.street,
            reference: item.reference,
            regionId,
            city: 'Campinas',
            state: 'SP',
            latitude: region.latitude + item.offset * 0.00025,
            longitude: region.longitude + item.offset * 0.0002,
            role: type.mobility === 'mobile' ? 'base' : 'fixed',
          },
          ['equipmentId'],
        );
        if (item.lastPosition) {
          await positionRepository.upsert(
            {
              equipmentId: persisted.id,
              latitude: item.lastPosition.latitude,
              longitude: item.lastPosition.longitude,
              recordedAt: new Date(Date.now() - item.lastPosition.minutesAgo * 60_000),
            },
            ['equipmentId'],
          );
        } else {
          await positionRepository.delete({ equipmentId: persisted.id });
        }
      }

      const agentRepository = manager.getRepository(AgentEntity);
      const agentPositionRepository = manager.getRepository(AgentPositionEntity);
      for (const [index, agent] of agents.entries()) {
        const organizationId = organizationIds.get(agent.organizationCode);
        const region = regions.find(({ code }) => code === agent.regionCode);
        const regionId = regionIds.get(agent.regionCode);
        if (!organizationId || !region || !regionId) throw new Error('Agent seed references are incomplete.');
        await agentRepository.upsert(
          {
            identifier: agent.identifier,
            name: agent.name,
            category: agent.category,
            organizationId,
            availability: agent.availability,
          },
          ['identifier'],
        );
        const persisted = await agentRepository.findOneByOrFail({ identifier: agent.identifier });
        await agentPositionRepository.upsert(
          {
            agentId: persisted.id,
            latitude: region.latitude + index * 0.00015,
            longitude: region.longitude - index * 0.0001,
            recordedAt: new Date(Date.now() - (index + 1) * 5 * 60_000),
          },
          ['agentId'],
        );
      }

      const maintenanceRepository = manager.getRepository(MaintenanceEntity);
      for (const item of maintenanceRecords) {
        const equipmentId = equipmentIds.get(item.serialNumber);
        if (!equipmentId) throw new Error('Maintenance seed equipment is missing.');
        await maintenanceRepository.upsert(
          {
            id: item.id,
            equipmentId,
            kind: item.kind,
            status: item.status,
            priority: item.priority,
            description: item.description,
            scheduledDate: item.scheduledDate,
            completedAt: 'completedAt' in item ? item.completedAt : null,
          },
          ['id'],
        );
      }
    });
    const equipmentCount = await dataSource.getRepository(EquipmentEntity).count();
    const agentCount = await dataSource.getRepository(AgentEntity).count();
    console.info(`Seed demonstrativo concluído: ${equipmentCount} equipamentos e ${agentCount} agentes.`);
  } finally {
    await dataSource.destroy();
  }
}

await seed();
