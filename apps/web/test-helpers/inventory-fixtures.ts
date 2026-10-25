import type {
  AgentContract,
  EquipmentContract,
  EquipmentTypeContract,
  InventorySummary,
  MaintenanceContract,
  OrganizationContract,
  RegionContract,
} from '@fogo/contracts';

export const testOrganization: OrganizationContract = { id: 'org-1', code: 'MOB', name: 'Mobilidade' };

export const testRegion: RegionContract = {
  id: 'region-1', code: 'SOU', name: 'Sousas', zone: 'Leste', city: 'Campinas', state: 'SP',
};

export const testAgent: AgentContract = {
  id: 'agent-1', name: 'Equipe demonstrativa', identifier: 'EQ-01', category: 'traffic_agent',
  organizationId: testOrganization.id, organizationName: testOrganization.name, availability: 'available',
  position: { latitude: -22.9, longitude: -47.06, recordedAt: '2026-10-24T12:00:00.000Z', regionId: testRegion.id, regionName: testRegion.name },
  operationalBase: null, linkedEquipment: null, operationalNotes: null,
  dataOrigin: 'demo', createdAt: '2026-10-20T12:00:00.000Z', updatedAt: '2026-10-24T12:00:00.000Z',
};

export const testEquipment: EquipmentContract = {
  id: 'equipment-1', typeCode: 'speed_radar', typeLabel: 'Radar de velocidade', serialNumber: 'RAD-001',
  brand: 'DSIN', model: 'Radar X', organizationId: testOrganization.id, organizationName: testOrganization.name,
  status: 'operational', maintenancePriority: 'normal', dataOrigin: 'demo', nextMaintenanceDate: null,
  characteristics: { speedLimitKmh: 50 },
  location: {
    postalCode: '13000-000', street: 'Rua Central', reference: '100', regionId: testRegion.id,
    regionName: testRegion.name, city: testRegion.city, state: testRegion.state, latitude: -22.9, longitude: -47.06, role: 'fixed',
  },
  lastPosition: null, createdAt: '2026-10-20T12:00:00.000Z', updatedAt: '2026-10-24T12:00:00.000Z',
};

export const testEquipmentType: EquipmentTypeContract = {
  code: 'speed_radar', label: 'Radar de velocidade', mobility: 'fixed',
  characteristics: [
    { key: 'speedLimitKmh', label: 'Limite de velocidade', kind: 'number', required: true, minimum: 20, maximum: 130 },
    { key: 'technology', label: 'Tecnologia', kind: 'select', required: true, options: ['doppler', 'sectional'] },
  ],
};

export const testMaintenance: MaintenanceContract = {
  id: 'maintenance-1', equipmentId: testEquipment.id, serialNumber: testEquipment.serialNumber,
  typeLabel: testEquipment.typeLabel, kind: 'scheduled', status: 'scheduled', priority: 'normal',
  description: 'Inspeção de rotina', scheduledDate: '2026-11-01', completedAt: null, overdue: false,
  createdAt: '2026-10-24T12:00:00.000Z',
};

export const testSummary: InventorySummary = {
  totalEquipment: 1, operationalEquipment: 1, attentionEquipment: 0, immediateMaintenance: 0,
  overdueMaintenance: 0, upcomingMaintenance: 0, totalAgents: 1, availableAgents: 1,
  agentsOnDuty: 0, agentsOffDuty: 0, unavailableAgents: 0,
};
