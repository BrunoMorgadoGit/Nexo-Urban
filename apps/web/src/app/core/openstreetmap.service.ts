import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, map, Observable, of, switchMap } from 'rxjs';

export type GeoCoordinates = {
  latitude: number;
  longitude: number;
};

export type NominatimSearchResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
};

export type GeocodeAddressInput = {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export const OPENSTREETMAP_BASE_URL = new InjectionToken<string>('OPENSTREETMAP_BASE_URL', {
  providedIn: 'root',
  factory: () => 'https://nominatim.openstreetmap.org',
});

@Injectable({ providedIn: 'root' })
export class OpenStreetMapService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(OPENSTREETMAP_BASE_URL);

  geocodeQuery(query: string): Observable<GeoCoordinates | null> {
    const trimmed = query.trim();
    if (!trimmed) {
      return of(null);
    }

    const params = new HttpParams()
      .set('q', trimmed)
      .set('format', 'json')
      .set('limit', '1');

    return this.http.get<NominatimSearchResult[]>(`${this.baseUrl}/search`, { params }).pipe(
      map((results) => {
        if (!Array.isArray(results) || results.length === 0) {
          return null;
        }
        const first = results[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);
        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          return null;
        }
        return {
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lon.toFixed(6)),
        };
      }),
      catchError(() => of(null)),
    );
  }

  geocodeAddress(input: GeocodeAddressInput): Observable<GeoCoordinates | null> {
    const queries: string[] = [];
    const country = input.country?.trim() || 'Brasil';
    const street = input.street?.trim();
    const city = input.city?.trim();
    const state = input.state?.trim();
    const neighborhood = input.neighborhood?.trim();
    const postalCode = input.postalCode?.trim();

    if (street && city) {
      queries.push([street, city, state, country].filter(Boolean).join(', '));
    }
    if (postalCode) {
      queries.push([postalCode, country].filter(Boolean).join(', '));
    }
    if (neighborhood && city) {
      queries.push([neighborhood, city, state, country].filter(Boolean).join(', '));
    }
    if (city) {
      queries.push([city, state, country].filter(Boolean).join(', '));
    }

    return this.searchFirstMatch(queries);
  }

  private searchFirstMatch(queries: string[]): Observable<GeoCoordinates | null> {
    if (queries.length === 0) {
      return of(null);
    }

    const [first, ...rest] = queries;
    return this.geocodeQuery(first).pipe(
      switchMap((result) => {
        if (result) {
          return of(result);
        }
        return this.searchFirstMatch(rest);
      }),
    );
  }
}
