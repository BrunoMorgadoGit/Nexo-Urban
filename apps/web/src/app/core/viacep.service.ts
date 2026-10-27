import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, map, Observable, of, switchMap, throwError } from 'rxjs';
import { OpenStreetMapService } from './openstreetmap.service';

export type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean | string;
};

export type ViaCepResult = {
  postalCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
  latitude?: number;
  longitude?: number;
};

export const VIA_CEP_BASE_URL = new InjectionToken<string>('VIA_CEP_BASE_URL', {
  providedIn: 'root',
  factory: () => 'https://viacep.com.br/ws',
});

@Injectable({ providedIn: 'root' })
export class ViaCepService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(VIA_CEP_BASE_URL);
  private readonly osm = inject(OpenStreetMapService);

  cleanCep(cep: string): string {
    return (cep ?? '').replace(/\D/g, '');
  }

  isValidCep(cep: string): boolean {
    return /^\d{8}$/.test(this.cleanCep(cep));
  }

  formatCep(cep: string): string {
    const clean = this.cleanCep(cep);
    if (clean.length === 8) {
      return `${clean.slice(0, 5)}-${clean.slice(5)}`;
    }
    return cep;
  }

  lookupCep(cep: string): Observable<ViaCepResult | null> {
    const clean = this.cleanCep(cep);
    if (clean.length !== 8) {
      return of(null);
    }

    return this.http.get<ViaCepResponse>(`${this.baseUrl}/${clean}/json/`).pipe(
      switchMap((response) => {
        if (!response || response.erro === true || response.erro === 'true') {
          return of(null);
        }

        const postalCode = response.cep?.trim() || this.formatCep(clean);
        const street = response.logradouro?.trim() ?? '';
        const neighborhood = response.bairro?.trim() ?? '';
        const city = response.localidade?.trim() ?? '';
        const state = response.uf?.trim() ?? '';
        const complement = response.complemento?.trim() ?? '';

        return this.osm
          .geocodeAddress({
            street,
            neighborhood,
            city,
            state,
            postalCode,
          })
          .pipe(
            map((coords) => ({
              postalCode,
              street,
              neighborhood,
              city,
              state,
              complement,
              latitude: coords?.latitude,
              longitude: coords?.longitude,
            })),
            catchError(() =>
              of({
                postalCode,
                street,
                neighborhood,
                city,
                state,
                complement,
              }),
            ),
          );
      }),
      catchError((error: unknown) => throwError(() => error)),
    );
  }
}
