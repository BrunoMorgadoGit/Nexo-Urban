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
  dataOrigin: 'manual' | 'demo';
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
  position: (LastKnownPosition & { regionId: string | null; regionName: string | null }) | null;
  dataOrigin: 'manual' | 'demo';
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

export type MonitoringOverview = {
  demoMode: boolean;
  totalEquipment: number;
  eligibleEquipment: number;
  operationalEquipment: number;
  unavailableEquipment: number;
  availabilityPercent: number;
  agentsOnDuty: number;
  activeCriticalAlerts: number;
  overdueMaintenance: number;
  calculatedAt: string;
};

export type MapResourceContract = {
  id: string;
  kind: 'equipment' | 'agent';
  label: string;
  identifier: string;
  status: EquipmentStatus | AgentAvailability;
  typeCode: string | null;
  typeLabel: string;
  organizationId: string;
  organizationName: string;
  regionId: string | null;
  regionName: string | null;
  regionZone: string | null;
  locationDescription: string | null;
  latitude: number;
  longitude: number;
  positionRecordedAt: string;
  positionSource: 'fixed_location' | 'operational_base' | 'last_known';
  positionStale: boolean;
  dataOrigin: 'manual' | 'demo';
  maintenancePriority: MaintenancePriority | null;
  nextMaintenanceDate: string | null;
  detailPath: string;
};

export type MonitoringMapSnapshot = {
  demoMode: boolean;
  items: MapResourceContract[];
  withoutPosition: number;
  generatedAt: string;
};

export type MonitoringRegionSummary = {
  id: string;
  code: string;
  name: string;
  zone: string;
  city: string;
  state: string;
  registeredEquipment: number;
  eligibleEquipment: number;
  operationalEquipment: number;
  unavailableEquipment: number;
  stolenEquipment: number;
  agentsOnDuty: number;
  availabilityPercent: number;
};

export const monitoringAlertSeverities = ['critical', 'high', 'medium', 'low'] as const;
export type MonitoringAlertSeverity = (typeof monitoringAlertSeverities)[number];
export const monitoringAlertStatuses = ['open', 'acknowledged', 'resolved'] as const;
export type MonitoringAlertStatus = (typeof monitoringAlertStatuses)[number];
export const monitoringAlertCodes = [
  'equipment_malfunctioning',
  'equipment_unavailable',
  'equipment_stolen',
  'maintenance_immediate',
  'maintenance_overdue',
] as const;
export type MonitoringAlertCode = (typeof monitoringAlertCodes)[number];
export type MonitoringAlertResourceType = 'equipment' | 'maintenance';
export type MonitoringAlertActionType = 'created' | 'acknowledged' | 'note' | 'resolved';

export type MonitoringAlertAction = {
  id: string;
  type: MonitoringAlertActionType;
  note: string | null;
  actor: string;
  createdAt: string;
};

export type MonitoringAlert = {
  id: string;
  code: MonitoringAlertCode;
  severity: MonitoringAlertSeverity;
  status: MonitoringAlertStatus;
  title: string;
  description: string;
  resourceType: MonitoringAlertResourceType;
  resourceId: string;
  resourceLabel: string;
  organizationName: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  actions: MonitoringAlertAction[];
  detailPath: string;
};

export type MaintenanceAttention = {
  maintenance: MaintenanceContract;
  urgency: 'overdue' | 'immediate' | 'upcoming';
};

export type OperationalEventType =
  | 'equipment.updated'
  | 'agent.updated'
  | 'maintenance.created'
  | 'maintenance.updated'
  | 'alert.created'
  | 'alert.updated'
  | 'alert.resolved'
  | 'demo.scenario.changed';

export type OperationalEvent = {
  id: string;
  type: OperationalEventType;
  source: 'api' | 'demo';
  resourceType: 'equipment' | 'agent' | 'maintenance' | 'alert' | 'demo_scenario';
  resourceId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

export type DemoScenario = {
  mode: 'DEMONSTRATION';
  code: 'radar-outage';
  label: string;
  equipmentId: string;
  serialNumber: string;
  status: EquipmentStatus;
  initialStatus: 'operational';
  active: boolean;
};

export type DemoTimelineEntry = {
  id: string;
  occurredAt: string;
  serialNumber: string;
  eventType: OperationalEventType;
  source: 'api' | 'demo';
  status: string;
  description: string;
  equipmentId: string;
};

export const intelligenceSourceScopes = ['demo', 'manual', 'all'] as const;
export type IntelligenceSourceScope = (typeof intelligenceSourceScopes)[number];
export type IntelligenceRiskClassification = 'low' | 'moderate' | 'elevated' | 'critical' | 'insufficient_data';
export type IntelligenceDataQuality = 'sufficient' | 'limited' | 'insufficient';

export type IntelligenceRiskFactor = {
  code: string;
  label: string;
  observedValue: number;
  normalizedValue: number;
  weight: number;
  contribution: number;
  explanation: string;
};

export type IntelligenceSourceComposition = {
  syntheticObservations: number;
  syntheticIncidents: number;
  manualIncidents: number;
};

export type RegionalRiskAssessment = {
  regionId: string;
  regionName: string;
  zone: string;
  city: string;
  state: string;
  riskScore: number | null;
  classification: IntelligenceRiskClassification;
  evaluatedAt: string;
  referenceAt: string;
  windowStart: string;
  horizonHours: 24;
  historyWindowDays: 90;
  observationCount: number;
  latestObservationAt: string | null;
  failureCount: number;
  eligibleEquipmentCount: number;
  unavailableEquipmentCount: number;
  dataQuality: IntelligenceDataQuality;
  coverageDays: number;
  sourceScope: IntelligenceSourceScope;
  sourceComposition: IntelligenceSourceComposition;
  methodVersion: string;
  factors: IntelligenceRiskFactor[];
  recommendations: string[];
  /** Centro representativo calculado das coordenadas atuais dos equipamentos cadastrados; não é polígono regional. */
  locationCenter?: { latitude: number; longitude: number; equipmentCount: number } | null;
};

export type IntelligenceTrendPoint = {
  regionId: string;
  regionName: string;
  referenceAt: string;
  riskScore: number | null;
  classification: IntelligenceRiskClassification;
  failuresInWindow: number;
  failureRatePerTenEquipment: number;
};

export type RegionIntelligenceDetail = {
  risk: RegionalRiskAssessment;
  trend: IntelligenceTrendPoint[];
};

export type MaintenancePriorityReason = {
  code: string;
  label: string;
  evidence: string;
};

export type PredictiveMaintenancePriority = {
  equipmentId: string;
  serialNumber: string;
  label: string;
  typeCode: string;
  typeLabel: string;
  status: EquipmentStatus;
  organizationName: string;
  regionId: string;
  regionName: string;
  regionZone: string;
  dataOrigin: 'demo' | 'manual';
  priorityScore: number;
  recommendationType: 'corrective_urgent' | 'preventive_inspection' | 'monitor';
  failureCount90d: number;
  recentFailureCount30d: number;
  previousFailureCount30d: number;
  lastFailureAt: string | null;
  lastMaintenanceAt: string | null;
  nextMaintenanceDate: string | null;
  overdueMaintenanceCount: number;
  urgentMaintenanceCount: number;
  reasons: MaintenancePriorityReason[];
  detailPath: string;
};

export type IntelligenceOverview = {
  sourceScope: IntelligenceSourceScope;
  evaluatedAt: string;
  referenceAt: string;
  windowStart: string;
  horizonHours: 24;
  historyWindowDays: 90;
  methodVersion: string;
  dataQuality: IntelligenceDataQuality;
  sourceComposition: IntelligenceSourceComposition;
  regionCount: number;
  insufficientRegionCount: number;
  highestRiskRegions: RegionalRiskAssessment[];
  maintenancePriorities: PredictiveMaintenancePriority[];
  trendSummary: Array<{
    regionId: string;
    regionName: string;
    recentRatePerTenEquipment: number;
    previousRatePerTenEquipment: number;
    direction: 'increasing' | 'stable' | 'decreasing' | 'insufficient_data';
  }>;
};

export type IntelligenceBacktest = {
  sourceScope: IntelligenceSourceScope;
  evaluatedAt: string;
  methodVersion: string;
  horizonHours: 24;
  evaluationStart: string;
  evaluationEnd: string;
  sampleWindows: number;
  incidentWindows: number;
  excludedInsufficientWindows: number;
  incidentPrevalence: number | null;
  modelThreshold: number;
  baselineRule: string;
  modelPrecision: number | null;
  modelRecall: number | null;
  baselinePrecision: number | null;
  baselineRecall: number | null;
  modelConfusion: { truePositives: number; falsePositives: number; trueNegatives: number; falseNegatives: number };
  baselineConfusion: { truePositives: number; falsePositives: number; trueNegatives: number; falseNegatives: number };
  modelClassificationDistribution: { low: number; moderate: number; elevated: number; critical: number };
  modelPredictionRate: number | null;
  baselinePredictionRate: number | null;
  precisionAtOne: { evaluatedCutoffs: number; truePositives: number; precision: number | null; recall: number | null };
  evaluationQuality: 'sufficient' | 'insufficient_sample';
  periods: Array<{
    start: string;
    end: string;
    sampleWindows: number;
    incidentWindows: number;
    modelFlags: number;
    baselineFlags: number;
  }>;
  limitations: string[];
};
