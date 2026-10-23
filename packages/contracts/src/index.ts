export type HealthResponse = {
  status: 'ok';
  service: 'fogo-api';
  database: 'connected';
  timestamp: string;
};

export const equipmentStatuses = [
  'not_installed',
  'operational',
  'malfunctioning',
  'maintenance',
  'deactivated',
  'stolen',
] as const;
export type EquipmentStatus = (typeof equipmentStatuses)[number];

export const maintenancePriorities = ['low', 'normal', 'high', 'immediate'] as const;
export type MaintenancePriority = (typeof maintenancePriorities)[number];

export const agentCategories = [
  'traffic_agent',
  'municipal_guard',
  'police_officer',
] as const;
export type AgentCategory = (typeof agentCategories)[number];

export const agentAvailabilityStates = [
  'available',
  'on_duty',
  'unavailable',
  'off_duty',
] as const;
export type AgentAvailability = (typeof agentAvailabilityStates)[number];

export type EquipmentTypeContract = {
  code: string;
  label: string;
  mobility: 'fixed' | 'mobile';
  characteristics: Array<{
    key: string;
    label: string;
    kind: 'text' | 'number' | 'boolean' | 'select';
    required: boolean;
    options?: string[];
    minimum?: number;
    maximum?: number;
  }>;
};

export type OrganizationContract = {
  id: string;
  code: string;
  name: string;
};

export type RegionContract = {
  id: string;
  code: string;
  name: string;
  zone: string;
  city: string;
  state: string;
};

export type StructuredLocation = {
  postalCode: string;
  street: string;
  reference: string;
  regionId: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  role: 'fixed' | 'base';
};

export type EquipmentLocationContract = StructuredLocation & {
  regionName: string;
};

export type LastKnownPosition = {
  latitude: number;
  longitude: number;
  recordedAt: string;
};

export type EquipmentContract = {
  id: string;
  typeCode: string;
  typeLabel: string;
  serialNumber: string;
  brand: string;
  model: string;
  organizationId: string;
  organizationName: string;
  status: EquipmentStatus;
  maintenancePriority: MaintenancePriority;
  nextMaintenanceDate: string | null;
  characteristics: Record<string, string | number | boolean>;
  location: EquipmentLocationContract;
  lastPosition: LastKnownPosition | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentContract = {
  id: string;
  name: string;
  identifier: string;
  category: AgentCategory;
  organizationId: string;
  organizationName: string;
  availability: AgentAvailability;
  position: LastKnownPosition | null;
  createdAt: string;
  updatedAt: string;
};

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type InventorySummary = {
  totalEquipment: number;
  operationalEquipment: number;
  attentionEquipment: number;
  immediateMaintenance: number;
  overdueMaintenance: number;
  upcomingMaintenance: number;
  totalAgents: number;
  availableAgents: number;
};

export type MaintenanceContract = {
  id: string;
  equipmentId: string;
  serialNumber: string;
  typeLabel: string;
  kind: 'immediate' | 'scheduled' | 'periodic';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: MaintenancePriority;
  description: string;
  scheduledDate: string;
  completedAt: string | null;
  overdue: boolean;
  createdAt: string;
};
