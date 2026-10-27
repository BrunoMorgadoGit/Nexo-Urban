import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { InventoryApiService } from '../core/inventory-api.service';
import { testEquipment, testEquipmentType, testOrganization, testRegion, testSummary } from '../../../test-helpers/inventory-fixtures';
import { EquipmentListComponent } from './equipment-list.component';

type EquipmentListHarness = {
  filterChanged(event: Event, field: 'typeCode' | 'status' | 'organizationId' | 'regionId'): void;
  searchChanged(event: Event): void;
  changePage(delta: number): void;
  requestDeactivation(item: typeof testEquipment): void;
  cancelDeactivation(): void;
  deactivate(): void;
};

describe('EquipmentListComponent', () => {
  it('shows equipment and asks for confirmation before deactivation', async () => {
    const deactivateEquipment = vi.fn(() => of(undefined));
    const listEquipment = vi.fn(() => of({ items: [testEquipment], page: 1, pageSize: 10, total: 1, totalPages: 1 }));
    await TestBed.configureTestingModule({
      imports: [EquipmentListComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: {
        listEquipment, getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]),
        getRegions: () => of([testRegion]), getSummary: () => of(testSummary), deactivateEquipment,
      } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentListComponent);

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('DSIN Radar X');
    expect(root.textContent).toContain('Sousas');
    root.querySelector<HTMLButtonElement>('.icon-action--danger')?.click();
    await fixture.whenStable();
    expect(root.querySelector('[role="alertdialog"]')?.textContent).toContain('Desativar equipamento?');
    expect(deactivateEquipment).not.toHaveBeenCalled();

    root.querySelector<HTMLButtonElement>('[role="alertdialog"] .button--danger')?.click();
    await fixture.whenStable();
    expect(deactivateEquipment).toHaveBeenCalledWith(testEquipment.id);
    expect(listEquipment).toHaveBeenCalledTimes(2);
  });

  it('renders the empty state when the selected filters match no equipment', async () => {
    await TestBed.configureTestingModule({
      imports: [EquipmentListComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: {
        listEquipment: () => of({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }),
        getEquipmentTypes: () => of([]), getOrganizations: () => of([]), getRegions: () => of([]), getSummary: () => of(testSummary),
      } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentListComponent);

    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nenhum equipamento encontrado');
  });

  it('recovers from lookup and list errors, applies filters, and handles failed deactivation', async () => {
    const listEquipment = vi.fn()
      .mockReturnValueOnce(throwError(() => ({ status: 503, error: { message: 'Inventário indisponível.' } })))
      .mockReturnValue(of({ items: [testEquipment], page: 1, pageSize: 10, total: 1, totalPages: 2 }));
    const deactivateEquipment = vi.fn(() => throwError(() => ({ status: 409, error: { message: 'Não é possível desativar agora.' } })));
    await TestBed.configureTestingModule({
      imports: [EquipmentListComponent],
      providers: [provideRouter([]), { provide: InventoryApiService, useValue: {
        listEquipment,
        getEquipmentTypes: () => throwError(() => new Error('types failure')),
        getOrganizations: () => throwError(() => new Error('organizations failure')),
        getRegions: () => throwError(() => new Error('regions failure')),
        getSummary: () => throwError(() => new Error('summary failure')),
        deactivateEquipment,
      } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentListComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as EquipmentListHarness;
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="alert"]')?.textContent).not.toContain('types failure');

    root.querySelector<HTMLButtonElement>('app-error-feedback button')?.click();
    await fixture.whenStable();
    expect(root.textContent).toContain('RAD-001');

    for (const [field, value] of [
      ['typeCode', 'speed_radar'], ['status', 'operational'], ['organizationId', 'org-1'], ['regionId', 'region-1'],
    ] as const) {
      const select = document.createElement('select');
      Object.defineProperty(select, 'value', { value, configurable: true });
      const event = new Event('change');
      Object.defineProperty(event, 'target', { value: select });
      component.filterChanged(event, field);
    }
    component.changePage(-1);
    component.changePage(1);
    expect(listEquipment).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, regionId: 'region-1', status: 'operational' }));

    const search = document.createElement('input');
    search.value = 'radar';
    const searchEvent = new Event('input');
    Object.defineProperty(searchEvent, 'target', { value: search });
    component.searchChanged(searchEvent);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fixture.whenStable();
    expect(listEquipment).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: 'radar' }));

    component.searchChanged(new Event('input'));
    component.filterChanged(new Event('change'), 'status');
    component.changePage(100);
    component.deactivate();
    component.requestDeactivation(testEquipment);
    component.deactivate();
    await fixture.whenStable();
    expect(deactivateEquipment).toHaveBeenCalledWith(testEquipment.id);
    expect(root.textContent).toContain('Não é possível desativar agora.');
    component.cancelDeactivation();
    await fixture.whenStable();
    expect(root.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
