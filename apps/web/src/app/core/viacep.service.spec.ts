import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OpenStreetMapService } from './openstreetmap.service';
import { VIA_CEP_BASE_URL, ViaCepResponse, ViaCepService } from './viacep.service';

describe('ViaCepService', () => {
  let service: ViaCepService;
  let http: HttpTestingController;
  const mockOsm = {
    geocodeAddress: vi.fn(() => of({ latitude: -22.905639, longitude: -47.059564 })),
    geocodeQuery: vi.fn(() => of(null)),
  };

  beforeEach(() => {
    mockOsm.geocodeAddress.mockClear();
    mockOsm.geocodeAddress.mockReturnValue(of({ latitude: -22.905639, longitude: -47.059564 }));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: VIA_CEP_BASE_URL, useValue: 'https://viacep.test/ws' },
        { provide: OpenStreetMapService, useValue: mockOsm },
      ],
    });
    service = TestBed.inject(ViaCepService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('cleans non-digits and validates 8-digit CEPs', () => {
    expect(service.cleanCep('13010-000')).toBe('13010000');
    expect(service.cleanCep(' 13.010-000 ')).toBe('13010000');
    expect(service.isValidCep('13010-000')).toBe(true);
    expect(service.isValidCep('13010')).toBe(false);
    expect(service.isValidCep('abc')).toBe(false);
    expect(service.formatCep('13010000')).toBe('13010-000');
    expect(service.formatCep('123')).toBe('123');
  });

  it('returns null without HTTP request when CEP is not 8 digits', () => {
    let result: unknown = 'initial';
    service.lookupCep('123').subscribe((res) => {
      result = res;
    });
    expect(result).toBeNull();
    http.expectNone('https://viacep.test/ws/123/json/');
  });

  it('queries ViaCEP endpoint and enriches address with OpenStreetMap coordinates', () => {
    let result: unknown;
    service.lookupCep('13.010-000').subscribe((res) => {
      result = res;
    });

    const req = http.expectOne('https://viacep.test/ws/13010000/json/');
    expect(req.request.method).toBe('GET');

    const fixtureResponse: ViaCepResponse = {
      cep: '13010-000',
      logradouro: 'Praça Bento Quirino',
      complemento: 'lado ímpar',
      bairro: 'Centro',
      localidade: 'Campinas',
      uf: 'SP',
    };
    req.flush(fixtureResponse);

    expect(mockOsm.geocodeAddress).toHaveBeenCalledWith({
      street: 'Praça Bento Quirino',
      neighborhood: 'Centro',
      city: 'Campinas',
      state: 'SP',
      postalCode: '13010-000',
    });

    expect(result).toEqual({
      postalCode: '13010-000',
      street: 'Praça Bento Quirino',
      neighborhood: 'Centro',
      city: 'Campinas',
      state: 'SP',
      complement: 'lado ímpar',
      latitude: -22.905639,
      longitude: -47.059564,
    });
  });

  it('returns address data even when OpenStreetMap geocoding fails', () => {
    mockOsm.geocodeAddress.mockReturnValue(throwError(() => new Error('OSM down')));

    let result: unknown;
    service.lookupCep('13010-000').subscribe((res) => {
      result = res;
    });

    const req = http.expectOne('https://viacep.test/ws/13010000/json/');
    req.flush({
      cep: '13010-000',
      logradouro: 'Rua Central',
      bairro: 'Centro',
      localidade: 'Campinas',
      uf: 'SP',
    });

    expect(result).toEqual({
      postalCode: '13010-000',
      street: 'Rua Central',
      neighborhood: 'Centro',
      city: 'Campinas',
      state: 'SP',
      complement: '',
    });
  });

  it('returns null when ViaCEP returns erro: "true"', () => {
    let result: unknown;
    service.lookupCep('99999-999').subscribe((res) => {
      result = res;
    });

    const req = http.expectOne('https://viacep.test/ws/99999999/json/');
    req.flush({ erro: 'true' });

    expect(result).toBeNull();
    expect(mockOsm.geocodeAddress).not.toHaveBeenCalled();
  });

  it('returns null when ViaCEP returns erro: true boolean', () => {
    let result: unknown;
    service.lookupCep('99999-999').subscribe((res) => {
      result = res;
    });

    const req = http.expectOne('https://viacep.test/ws/99999999/json/');
    req.flush({ erro: true });

    expect(result).toBeNull();
  });

  it('propagates HTTP error when request fails', () => {
    let errorReceived: unknown;
    service.lookupCep('13010-000').subscribe({
      next: () => {
        throw new Error('should have failed');
      },
      error: (err) => {
        errorReceived = err;
      },
    });

    const req = http.expectOne('https://viacep.test/ws/13010000/json/');
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    expect(errorReceived).toBeDefined();
  });
});
