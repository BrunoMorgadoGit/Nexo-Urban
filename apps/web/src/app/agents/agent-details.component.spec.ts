import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { AgentContract } from '@fogo/contracts';
import { InventoryApiService } from '../core/inventory-api.service';
import { AgentDetailsComponent } from './agent-details.component';

const agent: AgentContract = {
  id: 'agent-1', name: 'Equipe demonstrativa', identifier: 'EQ-01', category: 'traffic_agent',
  organizationId: 'org-1', organizationName: 'Mobilidade', availability: 'available',
  position: { latitude: -22.9, longitude: -47.06, recordedAt: '2026-10-24T12:00:00.000Z', regionId: 'region-1', regionName: 'Sousas' },
  operationalBase: null, linkedEquipment: null, operationalNotes: null,
  dataOrigin: 'demo', createdAt: '2026-10-20T12:00:00.000Z', updatedAt: '2026-10-24T12:00:00.000Z',
};

describe('AgentDetailsComponent', () => {
  const route = (id: string | null) => ({ snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } });

  it('renders the agent record and its known location', async () => {
    const api = { getAgent: vi.fn(() => of(agent)) };
    await TestBed.configureTestingModule({
      imports: [AgentDetailsComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: api }, { provide: ActivatedRoute, useValue: route('agent-1') }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentDetailsComponent);

    await fixture.whenStable();

    const content = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(api.getAgent).toHaveBeenCalledWith('agent-1');
    expect(content).toContain('Equipe demonstrativa');
    expect(content).toContain('Agente de trânsito');
    expect(content).toContain('Sousas');
  });

  it('shows a validation message without requesting an absent route id', async () => {
    const api = { getAgent: vi.fn(() => of(agent)) };
    await TestBed.configureTestingModule({
      imports: [AgentDetailsComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: api }, { provide: ActivatedRoute, useValue: route(null) }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentDetailsComponent);

    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Identificador do agente inválido.');
    expect(api.getAgent).not.toHaveBeenCalled();
  });

  it('renders a safe API error state', async () => {
    await TestBed.configureTestingModule({
      imports: [AgentDetailsComponent],
      providers: [
        provideRouter([]),
        { provide: InventoryApiService, useValue: { getAgent: () => throwError(() => ({ status: 404, error: { message: 'Agente não encontrado.' } })) } },
        { provide: ActivatedRoute, useValue: route('missing') },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentDetailsComponent);

    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Agente não encontrado.');
  });
});
