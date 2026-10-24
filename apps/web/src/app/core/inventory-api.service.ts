import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_PATH } from './api-base';
import type {
  AgentContract,
  AgentCategory,
  AgentAvailability,
  DemoScenario,
  DemoTimelineEntry,
  EquipmentContract,
  EquipmentStatus,
  EquipmentTypeContract,
  InventorySummary,
  MaintenanceContract,
  MaintenancePriority,
  OrganizationContract,
  Page,
  RegionContract,
  StructuredLocation,
  MaintenanceAttention,
  MonitoringAlert,
  MonitoringMapSnapshot,
  MonitoringOverview,
  MonitoringRegionSummary,
  MonitoringAlertSeverity,
  IntelligenceBacktest,
  IntelligenceOverview,
  IntelligenceSourceScope,
  IntelligenceTrendPoint,
  PredictiveMaintenancePriority,
  RegionIntelligenceDetail,
  RegionalRiskAssessment,
} from '@fogo/contracts';
import { Observable } from 'rxjs';

export type EquipmentWriteInput = {
  typeCode: string;
  serialNumber: string;
  brand: string;
  model: string;
  organizationId: string;
  status: EquipmentStatus;
  maintenancePriority: MaintenancePriority;
  nextMaintenanceDate: string | null;
  characteristics: Record<string, string | number | boolean>;
  location: StructuredLocation;
  lastPosition?: { latitude: number; longitude: number; recordedAt: string };
};

export type AgentWriteInput = {
  name: string;
  identifier: string;
  category: AgentCategory;
  organizationId: string;
  availability: AgentAvailability;
  position?: { latitude: number; longitude: number; recordedAt: string; regionId?: string | null };
};

export type MonitoringMapFilters = {
  resourceType?: 'all' | 'equipment' | 'agent';
  typeCode?: string;
  status?: string;
  organizationId?: string;
  regionId?: string;
  regionZone?: string;
  west?: number;
  south?: number;
  east?: number;
  north?: number;
};

export type MonitoringAlertFilters = {
  page?: number;
  pageSize?: number;
  severity?: MonitoringAlertSeverity;
  status?: string;
  code?: MonitoringAlert['code'];
  resourceId?: string;
};

export type EquipmentFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  typeCode?: string;
  status?: string;
  organizationId?: string;
  regionId?: string;
};

export type AgentFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  availability?: string;
  organizationId?: string;
};

export type MaintenanceFilters = {
  page?: number;
  pageSize?: number;
  equipmentId?: string;
  status?: string;
  overdueOnly?: boolean;
};

export type MaintenanceWriteInput = {
  equipmentId: string;
  kind: 'immediate' | 'scheduled' | 'periodic';
  priority: MaintenancePriority;
  description: string;
  scheduledDate: string;
};

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private readonly http = inject(HttpClient);

  listEquipment(filters: EquipmentFilters = {}): Observable<Page<EquipmentContract>> {
    return this.http.get<Page<EquipmentContract>>(`${API_BASE_PATH}/equipments`, {
      params: this.toParams(filters),
    });
  }

  getEquipment(id: string): Observable<EquipmentContract> {
    return this.http.get<EquipmentContract>(`${API_BASE_PATH}/equipments/${id}`);
  }

  createEquipment(input: EquipmentWriteInput): Observable<EquipmentContract> {
    return this.http.post<EquipmentContract>(`${API_BASE_PATH}/equipments`, input);
  }

  updateEquipment(id: string, input: EquipmentWriteInput): Observable<EquipmentContract> {
    return this.http.put<EquipmentContract>(`${API_BASE_PATH}/equipments/${id}`, input);
  }

  deactivateEquipment(id: string): Observable<EquipmentContract> {
    return this.http.delete<EquipmentContract>(`${API_BASE_PATH}/equipments/${id}`);
  }

  listAgents(filters: AgentFilters = {}): Observable<Page<AgentContract>> {
    return this.http.get<Page<AgentContract>>(`${API_BASE_PATH}/agents`, {
      params: this.toParams(filters),
    });
  }

  getAgent(id: string): Observable<AgentContract> {
    return this.http.get<AgentContract>(`${API_BASE_PATH}/agents/${id}`);
  }

  createAgent(input: AgentWriteInput): Observable<AgentContract> {
    return this.http.post<AgentContract>(`${API_BASE_PATH}/agents`, input);
  }

  updateAgent(id: string, input: AgentWriteInput): Observable<AgentContract> {
    return this.http.put<AgentContract>(`${API_BASE_PATH}/agents/${id}`, input);
  }

  getEquipmentTypes(): Observable<EquipmentTypeContract[]> {
    return this.http.get<EquipmentTypeContract[]>(`${API_BASE_PATH}/equipment-types`);
  }

  getOrganizations(): Observable<OrganizationContract[]> {
    return this.http.get<OrganizationContract[]>(`${API_BASE_PATH}/organizations`);
  }

  getRegions(): Observable<RegionContract[]> {
    return this.http.get<RegionContract[]>(`${API_BASE_PATH}/regions`);
  }

  getSummary(): Observable<InventorySummary> {
    return this.http.get<InventorySummary>(`${API_BASE_PATH}/inventory/summary`);
  }

  getMonitoringOverview(): Observable<MonitoringOverview> {
    return this.http.get<MonitoringOverview>(`${API_BASE_PATH}/monitoring/overview`);
  }

  getMonitoringMap(filters: MonitoringMapFilters = {}): Observable<MonitoringMapSnapshot> {
    return this.http.get<MonitoringMapSnapshot>(`${API_BASE_PATH}/monitoring/map`, { params: this.toParams(filters) });
  }

  getMonitoringRegions(): Observable<MonitoringRegionSummary[]> {
    return this.http.get<MonitoringRegionSummary[]>(`${API_BASE_PATH}/monitoring/regions`);
  }

  getMonitoringAlert(id: string): Observable<MonitoringAlert> {
    return this.http.get<MonitoringAlert>(`${API_BASE_PATH}/monitoring/alerts/${id}`);
  }

  getIntelligenceOverview(sourceScope: IntelligenceSourceScope = 'demo'): Observable<IntelligenceOverview> {
    return this.http.get<IntelligenceOverview>(`${API_BASE_PATH}/intelligence/overview`, { params: this.toParams({ sourceScope }) });
  }

  getIntelligenceRegions(sourceScope: IntelligenceSourceScope = 'demo'): Observable<RegionalRiskAssessment[]> {
    return this.http.get<RegionalRiskAssessment[]>(`${API_BASE_PATH}/intelligence/regions`, { params: this.toParams({ sourceScope }) });
  }

  getIntelligenceRegion(id: string, sourceScope: IntelligenceSourceScope = 'demo'): Observable<RegionIntelligenceDetail> {
    return this.http.get<RegionIntelligenceDetail>(`${API_BASE_PATH}/intelligence/regions/${id}`, { params: this.toParams({ sourceScope }) });
  }

  getMaintenancePriorities(sourceScope: IntelligenceSourceScope = 'demo'): Observable<PredictiveMaintenancePriority[]> {
    return this.http.get<PredictiveMaintenancePriority[]>(`${API_BASE_PATH}/intelligence/maintenance-priorities`, { params: this.toParams({ sourceScope }) });
  }

  getIntelligenceTrends(sourceScope: IntelligenceSourceScope = 'demo'): Observable<IntelligenceTrendPoint[]> {
    return this.http.get<IntelligenceTrendPoint[]>(`${API_BASE_PATH}/intelligence/trends`, { params: this.toParams({ sourceScope }) });
  }

  getIntelligenceValidation(sourceScope: IntelligenceSourceScope = 'demo'): Observable<IntelligenceBacktest> {
    return this.http.get<IntelligenceBacktest>(`${API_BASE_PATH}/intelligence/validation`, { params: this.toParams({ sourceScope }) });
  }

  getMaintenanceAttention(): Observable<MaintenanceAttention[]> {
    return this.http.get<MaintenanceAttention[]>(`${API_BASE_PATH}/monitoring/maintenance-alerts`);
  }

  listMonitoringAlerts(filters: MonitoringAlertFilters = {}): Observable<Page<MonitoringAlert>> {
    return this.http.get<Page<MonitoringAlert>>(`${API_BASE_PATH}/monitoring/alerts`, { params: this.toParams(filters) });
  }

  acknowledgeAlert(id: string): Observable<MonitoringAlert> {
    return this.http.post<MonitoringAlert>(`${API_BASE_PATH}/monitoring/alerts/${id}/acknowledge`, {});
  }

  addAlertNote(id: string, note: string): Observable<MonitoringAlert> {
    return this.http.post<MonitoringAlert>(`${API_BASE_PATH}/monitoring/alerts/${id}/notes`, { note });
  }

  resolveAlert(id: string): Observable<MonitoringAlert> {
    return this.http.post<MonitoringAlert>(`${API_BASE_PATH}/monitoring/alerts/${id}/resolve`, {});
  }

  getDemoScenario(): Observable<DemoScenario> {
    return this.http.get<DemoScenario>(`${API_BASE_PATH}/monitoring/demo/scenario`);
  }

  getDemoTimeline(): Observable<DemoTimelineEntry[]> {
    return this.http.get<DemoTimelineEntry[]>(`${API_BASE_PATH}/monitoring/demo/scenario/timeline`);
  }

  triggerDemoOutage(): Observable<DemoScenario> {
    return this.http.post<DemoScenario>(`${API_BASE_PATH}/monitoring/demo/scenario/outage`, {});
  }

  resetDemoScenario(): Observable<DemoScenario> {
    return this.http.post<DemoScenario>(`${API_BASE_PATH}/monitoring/demo/scenario/reset`, {});
  }

  listMaintenance(filters: MaintenanceFilters = {}): Observable<Page<MaintenanceContract>> {
    return this.http.get<Page<MaintenanceContract>>(`${API_BASE_PATH}/maintenance`, {
      params: this.toParams(filters),
    });
  }

  createMaintenance(input: MaintenanceWriteInput): Observable<MaintenanceContract> {
    return this.http.post<MaintenanceContract>(`${API_BASE_PATH}/maintenance`, input);
  }

  updateMaintenanceStatus(
    id: string,
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
  ): Observable<MaintenanceContract> {
    return this.http.patch<MaintenanceContract>(`${API_BASE_PATH}/maintenance/${id}/status`, { status });
  }

  private toParams<T extends object>(filters: T): HttpParams {
    let params = new HttpParams();
    for (const key of Object.keys(filters) as Array<keyof T>) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(String(key), String(value));
      }
    }
    return params;
  }
}

export function apiErrorMessage(error: unknown): string {
  const body = typeof error === 'object' && error !== null && 'error' in error
    ? (error as { error?: unknown }).error
    : undefined;
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message.join(' ');
    }
  }
  return 'Não foi possível concluir a solicitação. Tente novamente.';
}
