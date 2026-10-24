import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { AgentContract, InventorySummary } from '@fogo/contracts';
import { InventoryApiService } from '../core/inventory-api.service';
import { AgentsListComponent } from './agents-list.component';

const summary: InventorySummary = {
  totalEquipment: 0, operationalEquipment: 0, attentionEquipment: 0, immediateMaintenance: 0,
  overdueMaintenance: 0, upcomingMaintenance: 0, totalAgents: 1, availableAgents: 1,
};
const agent: AgentContract = {
  id: 'agent-1', name: 'Equipe demonstrativa', identifier: 'EQ-01', category: 'traffic_agent',
  organizationId: 'org-1', organizationName: 'Mobilidade', availability: 'available', position: null,
  dataOrigin: 'demo', createdAt: '2026-10-20T12:00:00.000Z', updatedAt: '2026-10-24T12:00:00.000Z',
};
const page = { items: [agent], page: 1, pageSize: 10, total: 1, totalPages: 2 };

describe('AgentsListComponent', () => {
  it('renders agent data and applies category and pagination filters', async () => {
    const listAgents = vi.fn(() => of(page));
    await TestBed.configureTestingModule({
      imports: [AgentsListComponent],
      providers: [
        provideRouter([]),
        { provide: InventoryApiService, useValue: {
          listAgents,
          getOrganizations: () => of([{ id: 'org-1', code: 'MOB', name: 'Mobilidade' }]),
          getSummary: () => of(summary),
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentsListComponent);

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Equipe demonstrativa');
    expect(root.textContent).toContain('Agente de trânsito');
    expect(root.textContent).toContain('Mobilidade');

    const category = root.querySelectorAll('select')[0] as HTMLSelectElement;
    category.value = 'traffic_agent';
    category.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(listAgents).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'traffic_agent', page: 1 }));

    root.querySelectorAll<HTMLButtonElement>('.pagination button')[1]?.click();
    await fixture.whenStable();
    expect(listAgents).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('shows an empty state and keeps invalid event targets from changing the search', async () => {
    const listAgents = vi.fn(() => of({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }));
    await TestBed.configureTestingModule({
      imports: [AgentsListComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: {
        listAgents, getOrganizations: () => of([]), getSummary: () => of(summary),
      } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentsListComponent);

    await fixture.whenStable();

    const component = fixture.componentInstance as unknown as {
      searchChanged(event: Event): void;
      filterChanged(event: Event, field: 'category' | 'availability' | 'organizationId'): void;
      changePage(delta: number): void;
    };
    component.searchChanged(new Event('input'));
    component.filterChanged(new Event('change'), 'category');
    component.changePage(1);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nenhum agente encontrado');
    expect(listAgents).toHaveBeenCalledOnce();
  });

  it('shows API errors, retries, applies availability, and debounces search', async () => {
    const listAgents = vi.fn()
      .mockReturnValueOnce(throwError(() => ({ status: 503, error: { message: 'Lista indisponível.' } })))
      .mockReturnValue(of(page));
    await TestBed.configureTestingModule({
      imports: [AgentsListComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: {
        listAgents,
        getOrganizations: () => throwError(() => new Error('lookup failure')),
        getSummary: () => of(summary),
      } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AgentsListComponent);
    await fixture.whenStable();
    (fixture.componentInstance as unknown as { changePage(delta: number): void }).changePage(1);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="alert"]')?.textContent?.trim()).toBeTruthy();
    expect(root.querySelector('[role="alert"]')?.textContent).not.toContain('lookup failure');

    root.querySelector<HTMLButtonElement>('.feedback--error button')?.click();
    await fixture.whenStable();
    expect(root.textContent).toContain('Equipe demonstrativa');

    const availability = root.querySelectorAll<HTMLSelectElement>('select')[1];
    availability.value = 'on_duty';
    availability.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    expect(listAgents).toHaveBeenLastCalledWith(expect.objectContaining({ availability: 'on_duty', page: 1 }));

    const search = root.querySelector<HTMLInputElement>('input[type="search"]');
    if (!search) throw new Error('Campo de busca não foi renderizado.');
    search.value = 'equipe';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fixture.whenStable();
    expect(listAgents).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'equipe', page: 1 }));
  });
});
