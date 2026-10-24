import { type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { InventoryApiService } from '../core/inventory-api.service';
import { testEquipment, testMaintenance } from '../../../test-helpers/inventory-fixtures';
import { MaintenanceListComponent } from './maintenance-list.component';

type MaintenanceModel = {
  equipmentId: string;
  kind: 'immediate' | 'scheduled' | 'periodic';
  priority: 'low' | 'normal' | 'high' | 'immediate';
  description: string;
  scheduledDate: string;
};
type MaintenanceHarness = {
  model: WritableSignal<MaintenanceModel>;
  save(): void;
  closeCreateForm(): void;
  overdueFilterChanged(event: Event): void;
  statusFilterChanged(event: Event): void;
  saving: () => boolean;
  showCreateForm: () => boolean;
  advance(item: typeof testMaintenance): void;
};

describe('MaintenanceListComponent', () => {
  it('applies list filters and advances a scheduled service', async () => {
    const listMaintenance = vi.fn(() => of({ items: [testMaintenance], page: 1, pageSize: 50, total: 1, totalPages: 1 }));
    const updateMaintenanceStatus = vi.fn(() => of(testMaintenance));
    await TestBed.configureTestingModule({
      imports: [MaintenanceListComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: {
        listMaintenance, listEquipment: () => of({ items: [testEquipment], page: 1, pageSize: 100, total: 1, totalPages: 1 }),
        updateMaintenanceStatus,
      } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(MaintenanceListComponent);

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Inspeção de rotina');
    const filters = root.querySelectorAll<HTMLSelectElement>('.toolbar select');
    filters[0].value = 'overdue';
    filters[0].dispatchEvent(new Event('change'));
    filters[1].value = 'scheduled';
    filters[1].dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(listMaintenance).toHaveBeenLastCalledWith(expect.objectContaining({ overdueOnly: true, status: 'scheduled' }));

    root.querySelector<HTMLButtonElement>('button.text-action')?.click();
    await fixture.whenStable();
    expect(updateMaintenanceStatus).toHaveBeenCalledWith(testMaintenance.id, 'in_progress');
  });

  it('opens the creation form and prevents saving an incomplete request', async () => {
    const createMaintenance = vi.fn(() => of(testMaintenance));
    await TestBed.configureTestingModule({
      imports: [MaintenanceListComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: {
        listMaintenance: () => of({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }),
        listEquipment: () => of({ items: [testEquipment], page: 1, pageSize: 100, total: 1, totalPages: 1 }),
        createMaintenance,
      } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(MaintenanceListComponent);

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.page-heading button')?.click();
    await fixture.whenStable();
    expect(root.querySelector('[role="dialog"]')).not.toBeNull();

    root.querySelector<HTMLFormElement>('[role="dialog"] form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(createMaintenance).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Selecione um equipamento.');
  });

  it('submits a valid maintenance request and shows the saved state', async () => {
    const createMaintenance = vi.fn(() => of(testMaintenance));
    await TestBed.configureTestingModule({
      imports: [MaintenanceListComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: {
        listMaintenance: () => of({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }),
        listEquipment: () => of({ items: [testEquipment], page: 1, pageSize: 100, total: 1, totalPages: 1 }),
        createMaintenance,
      } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(MaintenanceListComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as MaintenanceHarness;
    component.model.set({
      equipmentId: testEquipment.id,
      kind: 'scheduled',
      priority: 'normal',
      description: 'Revisar conectividade',
      scheduledDate: '2026-11-01',
    });
    component.save();
    await fixture.whenStable();

    expect(createMaintenance).toHaveBeenCalledWith({
      equipmentId: testEquipment.id,
      kind: 'scheduled',
      priority: 'normal',
      description: 'Revisar conectividade',
      scheduledDate: '2026-11-01',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Manutenção agendada com sucesso.');
  });

  it('reports list and status update failures safely', async () => {
    const updateMaintenanceStatus = vi.fn(() => throwError(() => ({ status: 409, error: { message: 'A manutenção não pode avançar.' } })));
    await TestBed.configureTestingModule({
      imports: [MaintenanceListComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: {
        listMaintenance: () => throwError(() => ({ status: 503, error: { message: 'Agenda indisponível.' } })),
        listEquipment: () => of({ items: [testEquipment], page: 1, pageSize: 100, total: 1, totalPages: 1 }),
        updateMaintenanceStatus,
      } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(MaintenanceListComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as MaintenanceHarness;
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Agenda indisponível.');

    component.advance({ ...testMaintenance, status: 'in_progress' });
    await fixture.whenStable();
    expect(updateMaintenanceStatus).toHaveBeenCalledWith(testMaintenance.id, 'completed');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('A manutenção não pode avançar.');
  });

  it('keeps the dialog open during save and ignores non-select filter events', async () => {
    const createRequest = new Subject<typeof testMaintenance>();
    const listMaintenance = vi.fn(() => of({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }));
    await TestBed.configureTestingModule({
      imports: [MaintenanceListComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: {
        listMaintenance, listEquipment: () => of({ items: [testEquipment], page: 1, pageSize: 100, total: 1, totalPages: 1 }),
        createMaintenance: () => createRequest.asObservable(),
      } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(MaintenanceListComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as MaintenanceHarness;
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.page-heading button')?.click();
    const current = component.model();
    component.model.set({ ...current, equipmentId: testEquipment.id, description: 'Revisar conexão' });
    component.save();
    expect(component.saving()).toBe(true);
    component.closeCreateForm();
    expect(component.showCreateForm()).toBe(true);

    component.overdueFilterChanged(new Event('change'));
    component.statusFilterChanged(new Event('change'));
    expect(listMaintenance).toHaveBeenCalledOnce();
    createRequest.next(testMaintenance);
    await fixture.whenStable();
    expect(component.saving()).toBe(false);
  });

  it('shows a safe creation error when the API rejects a valid request', async () => {
    await TestBed.configureTestingModule({
      imports: [MaintenanceListComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: {
        listMaintenance: () => of({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }),
        listEquipment: () => throwError(() => new Error('equipment lookup failure')),
        createMaintenance: () => throwError(() => ({ status: 409, error: { message: 'Serviço não permitido.' } })),
      } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(MaintenanceListComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as MaintenanceHarness;
    component.model.set({
      equipmentId: testEquipment.id, kind: 'scheduled', priority: 'normal',
      description: 'Revisar conexão', scheduledDate: '2026-11-01',
    });
    component.save();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Serviço não permitido.');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('equipment lookup failure');
  });
});
