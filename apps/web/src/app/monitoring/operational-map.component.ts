import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, ViewChild, computed, inject, signal, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import type { EquipmentTypeContract, MapResourceContract, OrganizationContract, RegionContract } from '@fogo/contracts';
import { ErrorEvent, GeoJSONSource, getVersion, Map as MapLibreMap, MapLayerMouseEvent, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { catchError, forkJoin, of, startWith } from 'rxjs';
import { apiErrorMessage, InventoryApiService, type MonitoringMapFilters } from '../core/inventory-api.service';
import { MonitoringRealtimeService } from '../core/monitoring-realtime.service';

const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';
setWorkerUrl(`/maplibre-gl-worker.mjs?v=${getVersion()}`);

@Component({
  selector: 'app-operational-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './operational-map.component.html',
  styleUrl: './operational-map.component.scss',
})
export class OperationalMapComponent implements AfterViewInit, OnDestroy {
  readonly compact = input(false);
  @ViewChild('mapHost') private mapHost?: ElementRef<HTMLDivElement>;

  protected readonly items = signal<MapResourceContract[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(() => this.items().find((item) => item.id === this.selectedId()) ?? null);
  protected readonly types = signal<EquipmentTypeContract[]>([]);
  protected readonly organizations = signal<OrganizationContract[]>([]);
  protected readonly regions = signal<RegionContract[]>([]);
  protected readonly regionZones = computed(() => [...new Set(this.regions().map((region) => region.zone))].sort((left, right) => left.localeCompare(right)));
  protected readonly withoutPosition = signal(0);
  protected readonly demoMode = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly mapError = signal('');
  protected readonly demoBusy = signal(false);
  protected readonly filters = signal<MonitoringMapFilters>({ resourceType: 'all' });
  protected readonly itemCountLabel = computed(() => `${this.items().length} recursos no mapa`);

  private readonly api = inject(InventoryApiService);
  private readonly realtime = inject(MonitoringRealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private map: MapLibreMap | null = null;
  private mapReady = false;
  constructor() {
    this.realtime.acquire(this.destroyRef);
    this.loadLookups();
    this.observeRefresh();
  }

  ngAfterViewInit(): void {
    this.createMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
    this.mapReady = false;
  }

  protected changeFilter<K extends keyof MonitoringMapFilters>(key: K, value: MonitoringMapFilters[K] | ''): void {
    const next = { ...this.filters() };
    if (value === '') delete next[key];
    else next[key] = value;
    this.filters.set(next);
    this.loadResources();
  }

  protected statusLabel(item: MapResourceContract): string {
    const labels: Record<string, string> = {
      not_installed: 'Ainda não instalado', operational: 'Operacional', malfunctioning: 'Mau funcionamento',
      maintenance: 'Em manutenção', deactivated: 'Desativado', stolen: 'Furtado',
      available: 'Disponível', on_duty: 'Em atividade', unavailable: 'Indisponível', off_duty: 'Fora de serviço',
    };
    return labels[item.status] ?? item.status;
  }

  protected positionLabel(item: MapResourceContract): string {
    if (item.positionSource === 'fixed_location') return 'Localização fixa';
    if (item.positionSource === 'operational_base') return 'Base operacional';
    return item.positionStale ? 'Última posição desatualizada' : 'Última posição conhecida';
  }

  protected formatDate(value: string | null): string {
    if (!value) return 'Sem previsão';
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  protected runDemo(action: 'outage' | 'reset'): void {
    this.demoBusy.set(true);
    const request = action === 'outage' ? this.api.triggerDemoOutage() : this.api.resetDemoScenario();
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.demoBusy.set(false);
        this.loadResources();
      },
      error: (error: unknown) => {
        this.demoBusy.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }

  protected retry(): void {
    this.mapError.set('');
    this.error.set('');
    this.createMap(true);
    this.loadResources();
  }

  protected selectResource(item: MapResourceContract): void {
    this.selectedId.set(item.id);
    this.syncGeoJson();
  }

  protected clearSelection(): void {
    this.selectedId.set(null);
    this.syncGeoJson();
  }

  private observeRefresh(): void {
    // Refresh snapshots on the initial connection, later events and SSE reconnects.
    toObservable(this.realtime.refreshVersion)
      .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadResources());
  }

  private loadLookups(): void {
    forkJoin({
      types: this.api.getEquipmentTypes(),
      organizations: this.api.getOrganizations(),
      regions: this.api.getRegions(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lookups) => {
        this.types.set(lookups.types);
        this.organizations.set(lookups.organizations);
        this.regions.set(lookups.regions);
      },
      error: () => this.error.set('Não foi possível carregar as opções de filtro.'),
    });
  }

  private loadResources(): void {
    this.loading.set(true);
    this.api.getMonitoringMap(this.filters()).pipe(
      catchError((error: unknown) => {
        this.error.set(apiErrorMessage(error));
        return of(null);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((snapshot) => {
      this.loading.set(false);
      if (!snapshot) return;
      this.error.set('');
      this.items.set(snapshot.items);
      this.withoutPosition.set(snapshot.withoutPosition);
      this.demoMode.set(snapshot.demoMode);
      if (this.selectedId() && !snapshot.items.some((item) => item.id === this.selectedId())) {
        this.selectedId.set(null);
      }
      this.syncGeoJson();
    });
  }

  private createMap(recreate = false): void {
    if (!this.mapHost || (this.map && !recreate)) return;
    this.map?.remove();
    this.mapReady = false;
    this.mapError.set('');
    const map = new MapLibreMap({
      container: this.mapHost.nativeElement,
      center: [-47.0608, -22.9056],
      zoom: 10.5,
      minZoom: 8,
      maxZoom: 18,
      style: {
        version: 8,
        sources: {
          openstreetmap: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: tileAttribution,
          },
        },
        layers: [{
          id: 'openstreetmap-raster', type: 'raster', source: 'openstreetmap',
          paint: { 'raster-saturation': -0.35, 'raster-brightness-max': 0.82, 'raster-contrast': 0.08 },
        }],
      },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-left');
    map.on('load', () => {
      this.mapReady = true;
      this.addResourceLayers(map);
      this.syncGeoJson();
      setTimeout(() => map.resize(), 0);
    });
    map.on('click', 'resource-points', (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const id = feature?.properties?.['id'];
      const resource = typeof id === 'string' ? this.items().find((item) => item.id === id) : undefined;
      if (resource) this.selectResource(resource);
    });
    map.on('click', 'resource-clusters', (event: MapLayerMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, { layers: ['resource-clusters'] })[0];
      const clusterId = feature?.properties?.['cluster_id'];
      const source = map.getSource('resources') as GeoJSONSource | undefined;
      if (typeof clusterId !== 'number' || !source) return;
      void source.getClusterExpansionZoom(clusterId).then((zoom) => {
        if (typeof zoom === 'number') {
          const coordinates = feature.geometry.type === 'Point' ? feature.geometry.coordinates as [number, number] : undefined;
          if (coordinates) map.easeTo({ center: coordinates, zoom });
        }
      }).catch(() => undefined);
    });
    map.on('mouseenter', 'resource-points', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'resource-points', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'resource-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'resource-clusters', () => { map.getCanvas().style.cursor = ''; });
    map.on('error', (event: ErrorEvent) => {
      if (event.error && (event as ErrorEvent & { sourceId?: string }).sourceId === 'openstreetmap') {
        this.mapError.set('O mapa não conseguiu carregar os tiles. Verifique a conexão e tente novamente.');
      }
    });
    this.map = map;
  }

  private addResourceLayers(map: MapLibreMap): void {
    if (map.getSource('resources')) return;
    map.addSource('resources', {
      type: 'geojson',
      data: this.asFeatureCollection(),
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 44,
    });
    map.addLayer({
      id: 'resource-clusters', type: 'circle', source: 'resources', filter: ['has', 'point_count'],
      paint: { 'circle-color': '#b67c39', 'circle-radius': ['step', ['get', 'point_count'], 17, 12, 21, 40, 26], 'circle-stroke-color': '#e4bd83', 'circle-stroke-width': 1.5 },
    });
    map.addLayer({
      id: 'resource-cluster-count', type: 'symbol', source: 'resources', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'] },
      paint: { 'text-color': '#16191d' },
    });
    map.addLayer({
      id: 'resource-points', type: 'circle', source: 'resources', filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['case', ['==', ['get', 'kind'], 'agent'], '#7eb6e8', ['==', ['get', 'status'], 'stolen'], '#f07878', ['==', ['get', 'status'], 'malfunctioning'], '#ef8f52', ['==', ['get', 'status'], 'maintenance'], '#ef8f52', ['==', ['get', 'status'], 'deactivated'], '#89939c', ['==', ['get', 'status'], 'not_installed'], '#89939c', ['in', ['get', 'maintenancePriority'], ['literal', ['high', 'immediate']]], '#e3ae58', ['==', ['get', 'status'], 'operational'], '#56c48e', '#89939c'],
        'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 10, 7],
        'circle-opacity': ['case', ['boolean', ['get', 'stale'], false], 0.52, 0.96],
        'circle-stroke-color': ['case', ['boolean', ['get', 'selected'], false], '#ffffff', '#15191e'],
        'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 2.5, 1.5],
      },
    });
    map.addLayer({
      id: 'resource-glyphs', type: 'symbol', source: 'resources', filter: ['!', ['has', 'point_count']],
      layout: { 'text-field': ['get', 'glyph'], 'text-size': 8, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true },
      paint: { 'text-color': '#111519' },
    });
  }

  private syncGeoJson(): void {
    if (!this.mapReady || !this.map?.getSource('resources')) return;
    void (this.map.getSource('resources') as GeoJSONSource).setData(this.asFeatureCollection())
      .catch(() => this.mapError.set('Não foi possível atualizar os marcadores. Tente recarregar o mapa.'));
  }

  private asFeatureCollection(): FeatureCollection<Point> {
    const selectedId = this.selectedId();
    return {
      type: 'FeatureCollection',
      features: this.items().map((item) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [item.longitude, item.latitude] },
        properties: {
          id: item.id,
          kind: item.kind,
          status: item.status,
          maintenancePriority: item.maintenancePriority,
          stale: item.positionStale,
          selected: item.id === selectedId,
          glyph: item.kind === 'agent' ? 'AG' : item.typeCode?.slice(0, 2).toUpperCase() ?? 'EQ',
          identifier: item.identifier,
        },
      })),
    };
  }
}
