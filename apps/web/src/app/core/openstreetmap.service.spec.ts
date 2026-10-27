import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  OPENSTREETMAP_BASE_URL,
  OpenStreetMapService,
} from './openstreetmap.service';

describe('OpenStreetMapService', () => {
  let service: OpenStreetMapService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OPENSTREETMAP_BASE_URL, useValue: 'https://nominatim.test' },
      ],
    });
    service = TestBed.inject(OpenStreetMapService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('returns null when query is blank without making HTTP request', () => {
    let result: unknown = 'init';
    service.geocodeQuery('   ').subscribe((res) => {
      result = res;
    });
    expect(result).toBeNull();
    http.expectNone('https://nominatim.test/search');
  });

  it('parses valid coordinates from Nominatim search response', () => {
    let result: unknown;
    service.geocodeQuery('Campinas, Brasil').subscribe((res) => {
      result = res;
    });

    const req = http.expectOne((r) => r.url === 'https://nominatim.test/search');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('Campinas, Brasil');
    expect(req.request.params.get('format')).toBe('json');
    expect(req.request.params.get('limit')).toBe('1');

    req.flush([
      {
        place_id: 12345,
        lat: '-22.905639',
        lon: '-47.059564',
        display_name: 'Campinas, São Paulo, Brasil',
      },
    ]);

    expect(result).toEqual({
      latitude: -22.905639,
      longitude: -47.059564,
    });
  });

  it('returns null when results array is empty', () => {
    let result: unknown;
    service.geocodeQuery('Lugar Inexistente 9999').subscribe((res) => {
      result = res;
    });

    const req = http.expectOne((r) => r.url === 'https://nominatim.test/search');
    req.flush([]);

    expect(result).toBeNull();
  });

  it('handles HTTP error gracefully returning null', () => {
    let result: unknown;
    service.geocodeQuery('Erro').subscribe((res) => {
      result = res;
    });

    const req = http.expectOne((r) => r.url === 'https://nominatim.test/search');
    req.flush('Error', { status: 500, statusText: 'Internal Error' });

    expect(result).toBeNull();
  });

  it('tries fallback queries in sequence until a match is found', () => {
    let result: unknown;
    service
      .geocodeAddress({
        street: 'Rua Desconhecida',
        neighborhood: 'Sousas',
        city: 'Campinas',
        state: 'SP',
        postalCode: '13010-000',
      })
      .subscribe((res) => {
        result = res;
      });

    // 1st request: Street + City + State + Country
    const req1 = http.expectOne((r) => r.url === 'https://nominatim.test/search');
    expect(req1.request.params.get('q')).toBe('Rua Desconhecida, Campinas, SP, Brasil');
    req1.flush([]);

    // 2nd request: Postal code + Country
    const req2 = http.expectOne((r) => r.url === 'https://nominatim.test/search');
    expect(req2.request.params.get('q')).toBe('13010-000, Brasil');
    req2.flush([]);

    // 3rd request: Neighborhood + City + State + Country
    const req3 = http.expectOne((r) => r.url === 'https://nominatim.test/search');
    expect(req3.request.params.get('q')).toBe('Sousas, Campinas, SP, Brasil');
    req3.flush([
      {
        place_id: 999,
        lat: '-22.881229',
        lon: '-46.969887',
        display_name: 'Sousas, Campinas, Brasil',
      },
    ]);

    expect(result).toEqual({
      latitude: -22.881229,
      longitude: -46.969887,
    });
  });
});
