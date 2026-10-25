import { Component, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { AgentContract, OrganizationContract, RegionContract } from '@fogo/contracts';
import { InventoryApiService } from '../core/inventory-api.service';
import { AgentEditorComponent } from './agent-editor.component';

@Component({ standalone: true, template: '' })
class AgentRecordRouteStub {}

const organization: OrganizationContract = { id: 'org-1', code: 'MOB', name: 'Mobilidade' };
const region: RegionContract = { id: 'region-1', code: 'SOU', name: 'Sousas', zone: 'Leste', city: 'Campinas', state: 'SP' };
const agent: AgentContract = {
  id: 'agent-1', name: 'Equipe demonstrativa', identifier: 'EQ-01', category: 'traffic_agent',
  organizationId: organization.id, organizationName: organization.name, availability: 'available',
  position: null, operationalBase: null, linkedEquipment: null, operationalNotes: null,
  dataOrigin: 'manual', createdAt: '2026-10-20T12:00:00.000Z', updatedAt: '2026-10-24T12:00:00.000Z',
};
type AgentEditorState = {
  name: string;
  identifier: string;
  category: AgentContract['category'];
  organizationId: string;
  availability: AgentContract['availability'];
  includePosition: boolean;
  position: { latitude: number; longitude: number; recordedAt: string; regionId: string };
  operationalBaseSelection: string;
  newBaseName: string;
  newBaseRegionId: string;
  newBaseLatitude: string;
  newBaseLongitude: string;
  equipmentId: string;
  operationalNotes: string;
};
type AgentEditorModelAccessor = { model: WritableSignal<AgentEditorState> };

function editorState(overrides: Partial<AgentEditorState> = {}): AgentEditorState {
  return {
    name: 'Agente de teste', identifier: 'AG-01', category: 'traffic_agent', organizationId: organization.id,
    availability: 'available', includePosition: false,
    position: { latitude: -22.9, longitude: -47.06, recordedAt: '2026-10-24T12:00', regionId: '' },
    operationalBaseSelection: '', newBaseName: '', newBaseRegionId: '', newBaseLatitude: '', newBaseLongitude: '',
    equipmentId: '', operationalNotes: '', ...overrides,
  };
}

describe('AgentEditorComponent', () => {
  it('shows optional position fields only when the position toggle is enabled', async () => {
    await TestBed.configureTestingModule({
      imports: [AgentEditorComponent],
      providers: [
        provideRouter([{ path: 'agents/:id', component: AgentRecordRouteStub }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getOrganizations: () => of([organization]), getRegions: () => of([region]),
          getOperationalBases: () => of([]), listEquipment: () => of({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }),
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentEditorComponent);

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Cadastrar agente');
    expect(root.querySelector('input[type="number"]')).toBeNull();

    const toggle = root.querySelector<HTMLInputElement>('input[type="checkbox"]');
    toggle?.click();
    await fixture.whenStable();

    expect(root.querySelectorAll('input[type="number"]')).toHaveLength(2);
    expect(root.querySelector('input[type="datetime-local"]')).not.toBeNull();
  });

  it('normalizes submitted identifiers and navigates to the saved record', async () => {
    const createAgent = vi.fn(() => of(agent));
    await TestBed.configureTestingModule({
      imports: [AgentEditorComponent],
      providers: [
        provideRouter([{ path: 'agents/:id', component: AgentRecordRouteStub }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getOrganizations: () => of([organization]), getRegions: () => of([region]),
          getOperationalBases: () => of([]), listEquipment: () => of({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }), createAgent,
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentEditorComponent);

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const model = (fixture.componentInstance as unknown as AgentEditorModelAccessor).model;
    model.set({
      name: '  Equipe teste  ', identifier: ' eq-02 ', category: 'traffic_agent',
      organizationId: organization.id, availability: 'available', includePosition: false,
      position: { latitude: -22.9, longitude: -47.06, recordedAt: '2026-10-24T12:00', regionId: '' },
      operationalBaseSelection: '', newBaseName: '', newBaseRegionId: '', newBaseLatitude: '', newBaseLongitude: '',
      equipmentId: '', operationalNotes: '',
    });
    root.querySelector<HTMLButtonElement>('form button[type="submit"]')?.click();

    await fixture.whenStable();

    expect(createAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Equipe teste', identifier: 'EQ-02', organizationId: organization.id,
    }));
  });

  it('loads an existing position and reports an update failure', async () => {
    const positionedAgent: AgentContract = {
      ...agent,
      position: { latitude: -22.9, longitude: -47.06, recordedAt: '2026-10-24T12:00:00.000Z', regionId: region.id, regionName: region.name },
    };
    const updateAgent = vi.fn(() => throwError(() => ({ status: 409, error: { message: 'Identificação já cadastrada.' } })));
    await TestBed.configureTestingModule({
      imports: [AgentEditorComponent],
      providers: [
        provideRouter([{ path: 'agents/:id', component: AgentRecordRouteStub }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: agent.id }) } } },
        { provide: InventoryApiService, useValue: {
          getOrganizations: () => of([organization]), getRegions: () => of([region]),
          getOperationalBases: () => of([]), listEquipment: () => of({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }),
          getAgent: () => of(positionedAgent), updateAgent,
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentEditorComponent);
    await fixture.whenStable();
    const model = (fixture.componentInstance as unknown as AgentEditorModelAccessor).model();
    expect(model.includePosition).toBe(true);
    expect(model.position.regionId).toBe(region.id);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('form button[type="submit"]')?.click();
    await fixture.whenStable();
    expect(updateAgent).toHaveBeenCalledWith(agent.id, expect.objectContaining({
      position: expect.objectContaining({ latitude: -22.9, longitude: -47.06, regionId: region.id }),
    }));
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Identificação já cadastrada.');
  });

  it('blocks a save when the selected organization is absent from the loaded options', async () => {
    const createAgent = vi.fn(() => of(agent));
    await TestBed.configureTestingModule({
      imports: [AgentEditorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getOrganizations: () => of([organization]), getRegions: () => of([region]),
          getOperationalBases: () => of([]), listEquipment: () => of({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }), createAgent,
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentEditorComponent);
    await fixture.whenStable();
    (fixture.componentInstance as unknown as AgentEditorModelAccessor).model.set({
      name: 'Equipe teste', identifier: 'EQ-02', category: 'traffic_agent',
      organizationId: 'missing-organization', availability: 'available', includePosition: false,
      position: { latitude: -22.9, longitude: -47.06, recordedAt: '2026-10-24T12:00', regionId: '' },
      operationalBaseSelection: '', newBaseName: '', newBaseRegionId: '', newBaseLatitude: '', newBaseLongitude: '',
      equipmentId: '', operationalNotes: '',
    });
    (fixture.componentInstance as unknown as { save(): void }).save();
    await fixture.whenStable();

    expect(createAgent).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Selecione um órgão responsável válido.');
  });

  it('submits a newly entered base, selected inventory equipment and operational notes', async () => {
    const createAgent = vi.fn(() => of(agent));
    const equipment = { id: 'vehicle-1', serialNumber: 'VT-01', typeLabel: 'Viatura', brand: 'Marca', model: 'SUV' };
    await TestBed.configureTestingModule({
      imports: [AgentEditorComponent],
      providers: [
        provideRouter([{ path: 'agents/:id', component: AgentRecordRouteStub }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getOrganizations: () => of([organization]), getRegions: () => of([region]), getOperationalBases: () => of([]),
          listEquipment: () => of({ items: [equipment], page: 1, pageSize: 20, total: 1, totalPages: 1 }), createAgent,
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentEditorComponent);
    await fixture.whenStable();
    const model = (fixture.componentInstance as unknown as AgentEditorModelAccessor).model;
    model.set({
      name: '  Agente Central  ', identifier: ' POL-09 ', category: 'civil_police_officer',
      organizationId: organization.id, availability: 'on_duty', includePosition: false,
      position: { latitude: -22.9, longitude: -47.06, recordedAt: '2026-10-24T12:00', regionId: '' },
      operationalBaseSelection: 'new', newBaseName: ' Base Central ', newBaseRegionId: region.id,
      newBaseLatitude: '-22.9', newBaseLongitude: '-47.06', equipmentId: equipment.id,
      operationalNotes: 'Turno da manhã',
    });

    (fixture.componentInstance as unknown as { save(): void }).save();
    await fixture.whenStable();

    expect(createAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Agente Central', identifier: 'POL-09', category: 'civil_police_officer',
      newOperationalBase: { name: 'Base Central', regionId: region.id, latitude: -22.9, longitude: -47.06 },
      equipmentId: equipment.id, operationalNotes: 'Turno da manhã',
    }));
  });

  it('rejects invalid base names, regions, coordinate pairs and coordinate ranges before saving', async () => {
    const createAgent = vi.fn(() => of(agent));
    await TestBed.configureTestingModule({
      imports: [AgentEditorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getOrganizations: () => of([organization]), getRegions: () => of([region]),
          getOperationalBases: () => of([]), listEquipment: () => of({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }), createAgent,
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentEditorComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as { model: WritableSignal<AgentEditorState>; save(): void };
    const invalidBases: Array<[Partial<AgentEditorState>, string]> = [
      [{ newBaseName: 'A' }, 'Informe o nome da base operacional.'],
      [{ newBaseName: 'Base válida', newBaseRegionId: 'missing-region' }, 'Selecione uma região válida para a base.'],
      [{ newBaseName: 'Base válida', newBaseLatitude: '-22.9' }, 'Informe latitude e longitude da base juntas.'],
      [{ newBaseName: 'Base válida', newBaseLatitude: '91', newBaseLongitude: '0' }, 'A latitude da base deve estar entre -90 e 90.'],
      [{ newBaseName: 'Base válida', newBaseLatitude: '0', newBaseLongitude: '-181' }, 'A longitude da base deve estar entre -180 e 180.'],
    ];

    for (const [overrides, message] of invalidBases) {
      component.model.set(editorState({ operationalBaseSelection: 'new', ...overrides }));
      component.save();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain(message);
    }

    component.model.set(editorState({ operationalBaseSelection: 'missing-base' }));
    component.save();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Selecione uma base operacional válida.');
    component.model.set(editorState({ equipmentId: 'missing-equipment' }));
    component.save();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Selecione um equipamento existente no inventário.');
    expect(createAgent).not.toHaveBeenCalled();
  });

  it('loads linked base and equipment, searches inventory choices, and reports lookup errors', async () => {
    const linkedEquipment = { id: 'linked-vehicle', serialNumber: 'VT-02', label: 'Viatura · VT-02' };
    const base = { id: 'base-1', name: 'Base Centro', regionId: region.id, regionName: region.name, latitude: null, longitude: null };
    const existingAgent: AgentContract = {
      ...agent, operationalBase: base, linkedEquipment, operationalNotes: 'Rádio operacional',
    };
    const equipment = { id: 'vehicle-1', serialNumber: 'VT-01', typeLabel: 'Viatura', brand: 'Marca', model: 'SUV' };
    const listEquipment = vi.fn()
      .mockReturnValueOnce(of({ items: [equipment], page: 1, pageSize: 20, total: 1, totalPages: 1 }))
      .mockReturnValueOnce(of({ items: [{ ...equipment, id: 'vehicle-2', serialNumber: 'VT-03' }], page: 1, pageSize: 20, total: 1, totalPages: 1 }))
      .mockReturnValueOnce(throwError(() => ({ status: 503, error: { message: 'Inventário indisponível.' } })));
    await TestBed.configureTestingModule({
      imports: [AgentEditorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: agent.id }) } } },
        { provide: InventoryApiService, useValue: {
          getOrganizations: () => of([organization]), getRegions: () => of([region]),
          getOperationalBases: () => of([base]), getAgent: () => of(existingAgent), listEquipment,
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentEditorComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      model: WritableSignal<AgentEditorState>;
      equipmentSearchChanged(event: Event): void;
    };
    expect(component.model().operationalBaseSelection).toBe(base.id);
    expect(component.model().equipmentId).toBe(linkedEquipment.id);
    const invalidEvent = new Event('input');
    component.equipmentSearchChanged(invalidEvent);
    expect(listEquipment).toHaveBeenCalledTimes(1);

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="search"]');
    if (!input) throw new Error('Campo de busca de equipamento não foi renderizado.');
    input.value = 'polícia';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fixture.whenStable();
    const equipmentSelect = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.form-section')[1].querySelectorAll<HTMLSelectElement>('select')[1];
    const options = Array.from(equipmentSelect.options);
    expect(options.map(({ value }) => value)).toContain(linkedEquipment.id);
    expect(options.map(({ value }) => value)).toContain('vehicle-2');
    expect(listEquipment).toHaveBeenLastCalledWith({ search: 'polícia', pageSize: 20 });

    input.value = 'erro';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Inventário indisponível.');
  });

  it('shows a safe error when the editor lookup request fails', async () => {
    await TestBed.configureTestingModule({
      imports: [AgentEditorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getOrganizations: () => throwError(() => new Error('lookup failure')),
          getRegions: () => of([]),
          getOperationalBases: () => of([]), listEquipment: () => of({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }),
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentEditorComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).not.toContain('lookup failure');
  });
});
