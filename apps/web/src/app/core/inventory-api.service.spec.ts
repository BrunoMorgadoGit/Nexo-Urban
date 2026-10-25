import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InventoryApiService, apiErrorMessage, type AgentWriteInput, type EquipmentWriteInput, type MaintenanceWriteInput } from './inventory-api.service';

const equipmentInput: EquipmentWriteInput = {
  typeCode: 'speed_radar', serialNumber: 'TEST-101', brand: 'Teste', model: 'Radar',
  organizationId: 'org-id', status: 'operational', maintenancePriority: 'normal', nextMaintenanceDate: null,
  characteristics: { speedLimitKmh: 50, lanes: 2, technology: 'doppler' },
  location: {
    postalCode: '13000000', street: 'Rua teste', reference: '10', regionId: 'region-id',
    city: 'Campinas', state: 'SP', latitude: -22.9, longitude: -47.06, role: 'fixed',
  },
};
const agentInput: AgentWriteInput = {
  name: 'Equipe de teste', identifier: 'EQ-10', category: 'traffic_agent',
  organizationId: 'org-id', availability: 'available',
};
const maintenanceInput: MaintenanceWriteInput = {
  equipmentId: 'equipment-1', kind: 'scheduled', priority: 'normal',
  description: 'Inspeção de rotina', scheduledDate: '2026-11-01',
};

describe('InventoryApiService', () => {
  let service: InventoryApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InventoryApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends list filters to the versioned equipment endpoint', () => {
    let received: unknown;
    service.listEquipment({ search: 'radar', status: 'operational', page: 2, pageSize: 10 }).subscribe((value) => {
      received = value;
    });
    const request = http.expectOne((item) => item.url === '/api/v1/equipments');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('search')).toBe('radar');
    expect(request.request.params.get('status')).toBe('operational');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ items: [], page: 2, pageSize: 10, total: 0, totalPages: 0 });
    expect(received).toEqual({ items: [], page: 2, pageSize: 10, total: 0, totalPages: 0 });
  });

  it('posts equipment data without substituting local records', () => {
    service.createEquipment(equipmentInput).subscribe();
    const request = http.expectOne('/api/v1/equipments');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(equipmentInput);
    request.flush({ id: 'equipment-id', ...equipmentInput });
  });

  it.each([
    ['reads equipment details', () => service.getEquipment('equipment-1'), 'GET', '/api/v1/equipments/equipment-1'],
    ['updates equipment records', () => service.updateEquipment('equipment-1', equipmentInput), 'PUT', '/api/v1/equipments/equipment-1'],
    ['deactivates equipment records', () => service.deactivateEquipment('equipment-1'), 'DELETE', '/api/v1/equipments/equipment-1'],
    ['lists agents', () => service.listAgents({ page: 2, search: 'equipe', availability: 'available' }), 'GET', '/api/v1/agents'],
    ['reads agent details', () => service.getAgent('agent-1'), 'GET', '/api/v1/agents/agent-1'],
    ['creates agent records', () => service.createAgent(agentInput), 'POST', '/api/v1/agents'],
    ['updates agent records', () => service.updateAgent('agent-1', agentInput), 'PUT', '/api/v1/agents/agent-1'],
    ['deletes agent records', () => service.deleteAgent('agent-1'), 'DELETE', '/api/v1/agents/agent-1'],
    ['loads reusable operational bases', () => service.getOperationalBases(), 'GET', '/api/v1/agents/operational-bases'],
    ['loads equipment types', () => service.getEquipmentTypes(), 'GET', '/api/v1/equipment-types'],
    ['loads organizations', () => service.getOrganizations(), 'GET', '/api/v1/organizations'],
    ['loads regions', () => service.getRegions(), 'GET', '/api/v1/regions'],
    ['loads the inventory summary', () => service.getSummary(), 'GET', '/api/v1/inventory/summary'],
    ['loads the monitoring overview', () => service.getMonitoringOverview(), 'GET', '/api/v1/monitoring/overview'],
    ['loads filtered monitoring resources', () => service.getMonitoringMap({ resourceType: 'equipment', status: 'operational' }), 'GET', '/api/v1/monitoring/map'],
    ['loads monitoring regions', () => service.getMonitoringRegions(), 'GET', '/api/v1/monitoring/regions'],
    ['loads a monitoring alert', () => service.getMonitoringAlert('alert-1'), 'GET', '/api/v1/monitoring/alerts/alert-1'],
    ['loads an intelligence overview', () => service.getIntelligenceOverview('manual'), 'GET', '/api/v1/intelligence/overview'],
    ['loads intelligence regions', () => service.getIntelligenceRegions('all'), 'GET', '/api/v1/intelligence/regions'],
    ['loads an intelligence region', () => service.getIntelligenceRegion('region-1', 'demo'), 'GET', '/api/v1/intelligence/regions/region-1'],
    ['loads predictive maintenance priorities', () => service.getMaintenancePriorities('manual'), 'GET', '/api/v1/intelligence/maintenance-priorities'],
    ['loads intelligence trends', () => service.getIntelligenceTrends('all'), 'GET', '/api/v1/intelligence/trends'],
    ['loads intelligence validation', () => service.getIntelligenceValidation('demo'), 'GET', '/api/v1/intelligence/validation'],
    ['loads maintenance attention', () => service.getMaintenanceAttention(), 'GET', '/api/v1/monitoring/maintenance-alerts'],
    ['lists monitoring alerts', () => service.listMonitoringAlerts({ page: 2, pageSize: 10 }), 'GET', '/api/v1/monitoring/alerts'],
    ['gets the demo scenario', () => service.getDemoScenario(), 'GET', '/api/v1/monitoring/demo/scenario'],
    ['gets the demo timeline', () => service.getDemoTimeline(), 'GET', '/api/v1/monitoring/demo/scenario/timeline'],
    ['triggers the demo outage', () => service.triggerDemoOutage(), 'POST', '/api/v1/monitoring/demo/scenario/outage'],
    ['resets the demo scenario', () => service.resetDemoScenario(), 'POST', '/api/v1/monitoring/demo/scenario/reset'],
    ['lists maintenance records', () => service.listMaintenance({ equipmentId: 'equipment-1', overdueOnly: false }), 'GET', '/api/v1/maintenance'],
    ['creates maintenance records', () => service.createMaintenance(maintenanceInput), 'POST', '/api/v1/maintenance'],
    ['updates maintenance status', () => service.updateMaintenanceStatus('maintenance-1', 'completed'), 'PATCH', '/api/v1/maintenance/maintenance-1/status'],
  ])('%s through its versioned endpoint', (
    _description: string,
    invoke: () => { subscribe: () => unknown },
    method: string,
    url: string,
  ) => {
    invoke().subscribe();
    const request = http.expectOne((candidate) => candidate.url === url);
    expect(request.request.method).toBe(method);
    request.flush({});
  });

  it('serializes false query values and omits empty filter values', () => {
    service.listMaintenance({ equipmentId: 'equipment-1', status: '', overdueOnly: false }).subscribe();
    const request = http.expectOne('/api/v1/maintenance?equipmentId=equipment-1&overdueOnly=false');
    expect(request.request.params.has('status')).toBe(false);
    request.flush({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  });

  it('posts alert actions with the expected payloads', () => {
    service.acknowledgeAlert('alert-1').subscribe();
    const acknowledge = http.expectOne('/api/v1/monitoring/alerts/alert-1/acknowledge');
    expect(acknowledge.request.method).toBe('POST');
    expect(acknowledge.request.body).toEqual({});
    acknowledge.flush({});

    service.addAlertNote('alert-1', 'Inspeção iniciada.').subscribe();
    const note = http.expectOne('/api/v1/monitoring/alerts/alert-1/notes');
    expect(note.request.body).toEqual({ note: 'Inspeção iniciada.' });
    note.flush({});

    service.resolveAlert('alert-1').subscribe();
    const resolve = http.expectOne('/api/v1/monitoring/alerts/alert-1/resolve');
    expect(resolve.request.body).toEqual({});
    resolve.flush({});
  });

  it('turns server validation messages into readable feedback', () => {
    expect(apiErrorMessage({ error: { message: ['CEP inválido.', 'Selecione o bairro.'] } })).toBe(
      'CEP inválido. Selecione o bairro.',
    );
    expect(apiErrorMessage(new Error('private stack'))).toContain('Não foi possível');
    expect(apiErrorMessage({ error: { message: 42 } })).toContain('Não foi possível');
    expect(apiErrorMessage({ error: { message: ['válida', 42] } })).toContain('Não foi possível');
  });
});
