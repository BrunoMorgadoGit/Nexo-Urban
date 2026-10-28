const mapRuntime = vi.hoisted(() => ({
  instance: null as unknown,
  lastGeoJson: null as unknown,
  sourceOptions: null as unknown,
  layers: new Map<string, unknown>(),
  clusterFeature: null as unknown,
  rejectSetData: false,
  easeTo: vi.fn(),
  setData: vi.fn(),
}));

vi.mock('maplibre-gl', () => {
  class FakeMap {
    private readonly listeners = new Map<string, (...args: unknown[]) => void>();
    private hasResourceSource = false;
    private readonly canvas = document.createElement('canvas');
    private readonly source = {
      setData: (data: unknown) => {
        mapRuntime.lastGeoJson = data;
        mapRuntime.setData(data);
        return mapRuntime.rejectSetData ? Promise.reject(new Error('map update failed')) : Promise.resolve();
      },
      getClusterExpansionZoom: () => Promise.resolve(12),
    };
    constructor() { mapRuntime.instance = this; }
    addControl(): void {}
    on(event: string, layerOrCallback: string | ((...args: unknown[]) => void), callback?: (...args: unknown[]) => void): void {
      this.listeners.set(typeof layerOrCallback === 'string' ? `${event}:${layerOrCallback}` : event, callback ?? layerOrCallback as (...args: unknown[]) => void);
    }
    trigger(event: string, ...args: unknown[]): void { this.listeners.get(event)?.(...args); }
    getLayer(id: string): boolean { return id === 'openstreetmap-raster' || id.startsWith('resource-'); }
    setPaintProperty(): void {}
    addSource(_id: string, options: unknown): void { mapRuntime.sourceOptions = options; this.hasResourceSource = true; }
    addLayer(layer: { id: string }): void { mapRuntime.layers.set(layer.id, layer); }
    getSource(): typeof this.source | undefined { return this.hasResourceSource ? this.source : undefined; }
    getCanvas(): HTMLCanvasElement { return this.canvas; }
    queryRenderedFeatures(): unknown[] { return mapRuntime.clusterFeature ? [mapRuntime.clusterFeature] : []; }
    easeTo(options: unknown): void { mapRuntime.easeTo(options); }
    resize(): void {}
    remove(): void {}
  }
  return { Map: FakeMap, NavigationControl: class {}, getVersion: () => 'test', setWorkerUrl: vi.fn() };
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { MapResourceContract } from '@fogo/contracts';
import { of, Subject } from 'rxjs';
import { InventoryApiService } from '../core/inventory-api.service';
import { MonitoringRealtimeService } from '../core/monitoring-realtime.service';
import { OperationalMapComponent } from './operational-map.component';

type TestMap = { trigger(event: string, ...args: unknown[]): void };

const resource: MapResourceContract = {
  id: 'equipment-1', kind: 'equipment', label: 'Radar demonstrativo', identifier: 'DEMO-RAD-001',
  status: 'operational', typeCode: 'speed_radar', typeLabel: 'Radar de velocidade',
  categoryCode: null,
  organizationId: 'org-1', organizationName: 'Mobilidade', regionId: 'region-1', regionName: 'Sousas', regionZone: 'Leste',
  locationDescription: 'Rua Central, 100', latitude: -22.9, longitude: -47.06,
  positionRecordedAt: '2026-10-24T12:00:00.000Z', positionSource: 'fixed_location', positionStale: false,
  dataOrigin: 'demo', maintenancePriority: 'normal', nextMaintenanceDate: null, detailPath: '/equipments/equipment-1',
};

const agentResource: MapResourceContract = {
  ...resource,
  id: 'agent-1', kind: 'agent', label: 'Agente demonstrativo', identifier: 'AG-DEMO-001',
  status: 'on_duty', typeCode: null, categoryCode: 'traffic_agent', typeLabel: 'Agente de trânsito',
  latitude: -22.90003, longitude: -47.06002,
  positionSource: 'agent_base', detailPath: '/agents/agent-1',
};

describe('OperationalMapComponent', () => {
  beforeEach(() => {
    mapRuntime.instance = null;
    mapRuntime.lastGeoJson = null;
    mapRuntime.sourceOptions = null;
    mapRuntime.layers.clear();
    mapRuntime.clusterFeature = null;
    mapRuntime.rejectSetData = false;
    mapRuntime.easeTo.mockClear();
    mapRuntime.setData.mockClear();
  });

  it('loads map resources, updates GeoJSON and opens the selected resource details', async () => {
    const getMonitoringMap = vi.fn(() => of({ items: [resource, agentResource], withoutPosition: 1, demoMode: true, generatedAt: '2026-10-24T12:00:00.000Z' }));
    const triggerDemoOutage = vi.fn(() => of(undefined));
    const resetDemoScenario = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [OperationalMapComponent],
      providers: [
        provideRouter([]),
        { provide: InventoryApiService, useValue: {
          getMonitoringMap, getEquipmentTypes: () => of([]), getOrganizations: () => of([]), getRegions: () => of([]),
          triggerDemoOutage, resetDemoScenario,
        } },
        { provide: MonitoringRealtimeService, useValue: { acquire: vi.fn(), refreshVersion: signal(0) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(OperationalMapComponent);

    await fixture.whenStable();
    (mapRuntime.instance as TestMap).trigger('load');
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      statusLabel(item: MapResourceContract): string;
      positionLabel(item: MapResourceContract): string;
      formatDate(value: string | null): string;
      runDemo(action: 'outage' | 'reset'): void;
      selectResource(item: MapResourceContract): void;
      mapError: () => string;
    };
    expect(component.statusLabel({ ...resource, status: 'malfunctioning' })).toBe('Mau funcionamento');
    expect(component.statusLabel({ ...resource, status: 'new-status' as MapResourceContract['status'] })).toBe('new-status');
    expect(component.positionLabel({ ...resource, positionSource: 'operational_base' })).toBe('Base operacional');
    expect(component.positionLabel({ ...resource, positionSource: 'agent_base' })).toBe('Base operacional do agente (posição fixa)');
    expect(component.positionLabel({ ...resource, positionSource: 'linked_equipment' })).toBe('Posição registrada do equipamento vinculado');
    expect(component.positionLabel({ ...resource, positionSource: 'last_known', positionStale: true })).toBe('Última posição desatualizada');
    expect(component.formatDate(null)).toBe('Sem previsão');
    component.runDemo('outage');
    component.runDemo('reset');
    expect(triggerDemoOutage).toHaveBeenCalledOnce();
    expect(resetDemoScenario).toHaveBeenCalledOnce();

    (mapRuntime.instance as TestMap).trigger('click:resource-points', { features: [{ properties: { id: resource.id } }] });
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(getMonitoringMap).toHaveBeenCalledWith({ resourceType: 'all' });
    expect(root.textContent).toContain('Radar demonstrativo');
    expect(root.textContent).toContain('Localização fixa');
    expect(root.textContent).toContain('1 agente(s) sem posição conhecida');
    expect(mapRuntime.setData).toHaveBeenCalled();
    expect(mapRuntime.sourceOptions).toMatchObject({ clusterMaxZoom: 17, clusterRadius: 56 });
    expect(mapRuntime.layers.get('resource-linked-agent-points')).toMatchObject({ paint: { 'circle-translate': [24, -20] } });
    expect(mapRuntime.layers.get('resource-linked-agent-glyphs')).toMatchObject({ paint: { 'text-translate': [24, -20] } });
    expect(mapRuntime.lastGeoJson).toMatchObject({ type: 'FeatureCollection', features: [
      { geometry: { coordinates: [-47.06, -22.9] }, properties: { glyph: 'RD' } },
      { properties: { glyph: 'AT', sharedPosition: true } },
    ] });
    expect(root.textContent).toContain('Radar de velocidade');
    expect(root.textContent).toContain('Agente de trânsito');

    mapRuntime.clusterFeature = { properties: { cluster_id: 3 }, geometry: { type: 'Point', coordinates: [-47.06, -22.9] } };
    (mapRuntime.instance as TestMap).trigger('click:resource-clusters', { point: { x: 4, y: 8 } });
    await fixture.whenStable();
    expect(mapRuntime.easeTo).toHaveBeenCalledWith({ center: [-47.06, -22.9], zoom: 12 });
    (mapRuntime.instance as TestMap).trigger('mouseenter:resource-points');
    expect((mapRuntime.instance as { getCanvas(): HTMLCanvasElement }).getCanvas().style.cursor).toBe('pointer');
    (mapRuntime.instance as TestMap).trigger('mouseleave:resource-points');
    expect((mapRuntime.instance as { getCanvas(): HTMLCanvasElement }).getCanvas().style.cursor).toBe('');

    mapRuntime.rejectSetData = true;
    const priorUpdates = mapRuntime.setData.mock.calls.length;
    component.selectResource(resource);
    await fixture.whenStable();
    await Promise.resolve();
    expect(mapRuntime.setData.mock.calls.length).toBeGreaterThan(priorUpdates);
    expect(component.mapError()).toContain('Não foi possível atualizar os marcadores.');
  });

  it('keeps the newest filter response when an older map request finishes later', async () => {
    const requests: Array<Subject<{ items: MapResourceContract[]; withoutPosition: number; demoMode: boolean; generatedAt: string }>> = [];
    const getMonitoringMap = vi.fn(() => {
      const response = new Subject<{ items: MapResourceContract[]; withoutPosition: number; demoMode: boolean; generatedAt: string }>();
      requests.push(response);
      return response;
    });
    await TestBed.configureTestingModule({
      imports: [OperationalMapComponent],
      providers: [
        provideRouter([]),
        { provide: InventoryApiService, useValue: {
          getMonitoringMap, getEquipmentTypes: () => of([]), getOrganizations: () => of([]), getRegions: () => of([]),
        } },
        { provide: MonitoringRealtimeService, useValue: { acquire: vi.fn(), refreshVersion: signal(0) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(OperationalMapComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      changeFilter(key: 'status', value: string): void;
      items(): MapResourceContract[];
    };
    const olderRequest = requests.at(-1)!;

    component.changeFilter('status', 'operational');
    const newestRequest = requests.at(-1)!;
    newestRequest.next({ items: [{ ...resource, id: 'new-filter-result', label: 'Resultado atual' }], withoutPosition: 0, demoMode: false, generatedAt: '2026-10-27T12:00:00.000Z' });
    olderRequest.next({ items: [{ ...resource, id: 'old-filter-result', label: 'Resultado antigo' }], withoutPosition: 0, demoMode: false, generatedAt: '2026-10-27T12:00:00.000Z' });

    expect(component.items().map(({ id }) => id)).toEqual(['new-filter-result']);
    fixture.destroy();
  });

  it('renders compact resource details and clears the selected resource on request', async () => {
    const getMonitoringMap = vi.fn()
      .mockReturnValueOnce(of({ items: [resource], withoutPosition: 0, demoMode: false, generatedAt: '2026-10-24T12:00:00.000Z' }))
      .mockReturnValueOnce(of({ items: [resource], withoutPosition: 0, demoMode: false, generatedAt: '2026-10-24T12:00:00.000Z' }))
      .mockReturnValue(of({ items: [], withoutPosition: 0, demoMode: false, generatedAt: '2026-10-24T12:00:00.000Z' }));
    await TestBed.configureTestingModule({
      imports: [OperationalMapComponent],
      providers: [
        provideRouter([]),
        { provide: InventoryApiService, useValue: {
          getMonitoringMap, getEquipmentTypes: () => of([]), getOrganizations: () => of([]), getRegions: () => of([]),
        } },
        { provide: MonitoringRealtimeService, useValue: { acquire: vi.fn(), refreshVersion: signal(0) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(OperationalMapComponent);
    fixture.componentRef.setInput('compact', true);

    await fixture.whenStable();
    (mapRuntime.instance as TestMap).trigger('load');
    (mapRuntime.instance as TestMap).trigger('click:resource-points', { features: [{ properties: { id: resource.id } }] });
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Abrir Mapa Vivo');
    expect(root.querySelector('.map-filters')).toBeNull();
    expect(root.querySelector('.resource-panel--compact')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[aria-label="Fechar detalhes"]')?.click();
    await fixture.whenStable();
    expect(root.querySelector('.resource-panel--compact')).toBeNull();
  });
});
