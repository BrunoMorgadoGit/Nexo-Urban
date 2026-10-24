import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InventoryApiService, apiErrorMessage } from './inventory-api.service';

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
    const input = {
      typeCode: 'speed_radar', serialNumber: 'TEST-101', brand: 'Teste', model: 'Radar',
      organizationId: 'org-id', status: 'operational' as const, maintenancePriority: 'normal' as const,
      nextMaintenanceDate: null, characteristics: { speedLimitKmh: 50, lanes: 2, technology: 'doppler' },
      location: {
        postalCode: '13000000', street: 'Rua teste', reference: '10', regionId: 'region-id',
        city: 'Campinas', state: 'SP', latitude: -22.9, longitude: -47.06, role: 'fixed' as const,
      },
    };
    service.createEquipment(input).subscribe();
    const request = http.expectOne('/api/v1/equipments');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({ id: 'equipment-id', ...input });
  });

  it('turns server validation messages into readable feedback', () => {
    expect(apiErrorMessage({ error: { message: ['CEP inválido.', 'Selecione o bairro.'] } })).toBe(
      'CEP inválido. Selecione o bairro.',
    );
    expect(apiErrorMessage(new Error('private stack'))).toContain('Não foi possível');
  });
});
