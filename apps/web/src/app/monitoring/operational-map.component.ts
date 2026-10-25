import { CommonModule, DOCUMENT } from '@angular/common';
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

  private readonly document = inject(DOCUMENT);
  private readonly api = inject(InventoryApiService);
  private readonly realtime = inject(MonitoringRealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private map: MapLibreMap | null = null;
  private mapReady = false;
  private themeObserver: MutationObserver | null = null;
  constructor() {
    this.realtime.acquire(this.destroyRef);
    this.loadLookups();
    this.observeRefresh();
  }

  ngAfterViewInit(): void {
    this.createMap();
    const Observer = this.document.defaultView?.MutationObserver;
    if (Observer) {
      this.themeObserver = new Observer(() => this.updateMapTheme());
      this.themeObserver.observe(this.document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
  }

  ngOnDestroy(): void {
    this.themeObserver?.disconnect();
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
    if (item.positionSource === 'agent_base') return 'Base operacional do agente (posição fixa)';
    if (item.positionSource === 'linked_equipment') return 'Posição registrada do equipamento vinculado';
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
          paint: { 'raster-saturation': this.isLightTheme() ? 0 : -0.35, 'raster-brightness-max': this.isLightTheme() ? 1 : 0.82, 'raster-contrast': this.isLightTheme() ? 0 : 0.08 },
        }],
      },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-left');
    map.on('load', () => {
      this.mapReady = true;
      this.updateMapTheme();
      this.addResourceLayers(map);
      this.syncGeoJson();
      setTimeout(() => map.resize(), 0);
    });
    const selectPoint = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const id = feature?.properties?.['id'];
      const resource = typeof id === 'string' ? this.items().find((item) => item.id === id) : undefined;
      if (resource) this.selectResource(resource);
    };
    map.on('click', 'resource-points', selectPoint);
    map.on('click', 'resource-linked-agent-points', selectPoint);
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
    map.on('mouseenter', 'resource-linked-agent-points', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'resource-linked-agent-points', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'resource-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'resource-clusters', () => { map.getCanvas().style.cursor = ''; });
    map.on('error', (event: ErrorEvent) => {
      if (event.error && (event as ErrorEvent & { sourceId?: string }).sourceId === 'openstreetmap') {
        this.mapError.set('O mapa não conseguiu carregar os tiles. Verifique a conexão e tente novamente.');
      }
    });
    this.map = map;
  }

  private isLightTheme(): boolean {
    return this.document.documentElement.getAttribute('data-theme') === 'light';
  }

  private updateMapTheme(): void {
    const map = this.map;
    if (!map?.getLayer('openstreetmap-raster')) return;
    const isLight = this.isLightTheme();
    map.setPaintProperty('openstreetmap-raster', 'raster-saturation', isLight ? 0 : -0.35);
    map.setPaintProperty('openstreetmap-raster', 'raster-brightness-max', isLight ? 1 : 0.82);
    map.setPaintProperty('openstreetmap-raster', 'raster-contrast', isLight ? 0 : 0.08);
  }

  private addResourceLayers(map: MapLibreMap): void {
    if (map.getSource('resources')) return;
    map.addSource('resources', {
      type: 'geojson',
      data: this.asFeatureCollection(),
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 40,
      clusterProperties: {
        problem_count: ['+', ['case', ['boolean', ['get', 'problemSignal'], false], 1, 0]],
      },
    });
    map.addLayer({
      id: 'resource-clusters', type: 'circle', source: 'resources', filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['case', ['>', ['get', 'problem_count'], 0], '#bf4054', '#276f7c'],
        'circle-radius': ['step', ['get', 'point_count'], 16, 12, 20, 40, 25],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2.5,
      },
    });
    map.addLayer({
      id: 'resource-cluster-count', type: 'symbol', source: 'resources', filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 13,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': '#17353d', 'text-halo-width': 0.5 },
    });
    map.addLayer({
      id: 'resource-points', type: 'circle', source: 'resources',
      filter: ['all', ['!', ['has', 'point_count']], ['!', ['get', 'sharedPosition']]],
      paint: {
        'circle-color': ['case', ['==', ['get', 'kind'], 'agent'], '#24a5f5', ['==', ['get', 'status'], 'stolen'], '#ed475a', ['==', ['get', 'status'], 'malfunctioning'], '#f07832', ['==', ['get', 'status'], 'maintenance'], '#f07832', ['==', ['get', 'status'], 'deactivated'], '#7a8791', ['==', ['get', 'status'], 'not_installed'], '#7a8791', ['in', ['get', 'maintenancePriority'], ['literal', ['high', 'immediate']]], '#d48a16', ['==', ['get', 'status'], 'operational'], '#17a96b', '#7a8791'],
        'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 13, 10],
        'circle-opacity': ['case', ['boolean', ['get', 'stale'], false], 0.52, 0.96],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 3, 2.5],
      },
    });
    map.addLayer({
      id: 'resource-linked-agent-points', type: 'circle', source: 'resources',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'sharedPosition'], true]],
      paint: {
        'circle-color': '#24a5f5',
        'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 13, 10],
        'circle-opacity': ['case', ['boolean', ['get', 'stale'], false], 0.52, 0.96],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 3, 2.5],
        'circle-translate': [18, -14],
        'circle-translate-anchor': 'viewport',
      },
    });
    map.addLayer({
      id: 'resource-glyphs', type: 'symbol', source: 'resources',
      filter: ['all', ['!', ['has', 'point_count']], ['!', ['get', 'sharedPosition']]],
      layout: { 'text-field': ['get', 'glyph'], 'text-size': 10, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': '#ffffff', 'text-halo-color': '#13202a', 'text-halo-width': 0.75 },
    });
    map.addLayer({
      id: 'resource-linked-agent-glyphs', type: 'symbol', source: 'resources',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'sharedPosition'], true]],
      layout: { 'text-field': ['get', 'glyph'], 'text-size': 10, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: {
        'text-color': '#ffffff', 'text-halo-color': '#13202a', 'text-halo-width': 0.75,
        'text-translate': [18, -14], 'text-translate-anchor': 'viewport',
      },
    });
  }

  private syncGeoJson(): void {
    if (!this.mapReady || !this.map?.getSource('resources')) return;
    void (this.map.getSource('resources') as GeoJSONSource).setData(this.asFeatureCollection())
      .catch(() => this.mapError.set('Não foi possível atualizar os marcadores. Tente recarregar o mapa.'));
  }

  private asFeatureCollection(): FeatureCollection<Point> {
    const selectedId = this.selectedId();
    const equipmentLocations = new Set(this.items()
      .filter((item) => item.kind === 'equipment')
      .map((item) => `${item.longitude}:${item.latitude}`));
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
          problemSignal: item.kind === 'equipment' && (item.status === 'malfunctioning' || item.status === 'stolen'),
          selected: item.id === selectedId,
          glyph: item.kind === 'agent' ? 'AG' : 'EQ',
          sharedPosition: item.kind === 'agent'
            && item.positionSource === 'linked_equipment'
            && equipmentLocations.has(`${item.longitude}:${item.latitude}`),
          identifier: item.identifier,
        },
      })),
    };
  }
}
