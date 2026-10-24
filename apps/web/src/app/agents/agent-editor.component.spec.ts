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
  position: null, dataOrigin: 'manual', createdAt: '2026-10-20T12:00:00.000Z', updatedAt: '2026-10-24T12:00:00.000Z',
};
type AgentEditorState = {
  name: string;
  identifier: string;
  category: AgentContract['category'];
  organizationId: string;
  availability: AgentContract['availability'];
  includePosition: boolean;
  position: { latitude: number; longitude: number; recordedAt: string; regionId: string };
};
type AgentEditorModelAccessor = { model: WritableSignal<AgentEditorState> };

describe('AgentEditorComponent', () => {
  it('shows optional position fields only when the position toggle is enabled', async () => {
    await TestBed.configureTestingModule({
      imports: [AgentEditorComponent],
      providers: [
        provideRouter([{ path: 'agents/:id', component: AgentRecordRouteStub }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getOrganizations: () => of([organization]), getRegions: () => of([region]),
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
          getOrganizations: () => of([organization]), getRegions: () => of([region]), createAgent,
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
          getOrganizations: () => of([organization]), getRegions: () => of([region]), getAgent: () => of(positionedAgent), updateAgent,
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
          getOrganizations: () => of([organization]), getRegions: () => of([region]), createAgent,
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentEditorComponent);
    await fixture.whenStable();
    (fixture.componentInstance as unknown as AgentEditorModelAccessor).model.set({
      name: 'Equipe teste', identifier: 'EQ-02', category: 'traffic_agent',
      organizationId: 'missing-organization', availability: 'available', includePosition: false,
      position: { latitude: -22.9, longitude: -47.06, recordedAt: '2026-10-24T12:00', regionId: '' },
    });
    (fixture.componentInstance as unknown as { save(): void }).save();
    await fixture.whenStable();

    expect(createAgent).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Selecione um órgão responsável válido.');
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
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentEditorComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).not.toContain('lookup failure');
  });
});
