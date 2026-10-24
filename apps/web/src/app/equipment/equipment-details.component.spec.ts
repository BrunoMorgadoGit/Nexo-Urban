import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { InventoryApiService } from '../core/inventory-api.service';
import { testEquipment, testEquipmentType, testMaintenance } from '../../../test-helpers/inventory-fixtures';
import { EquipmentDetailsComponent } from './equipment-details.component';

@Component({ standalone: true, template: '' })
class EquipmentsRouteStub {}

describe('EquipmentDetailsComponent', () => {
  it('renders location, specification and maintenance history', async () => {
    await TestBed.configureTestingModule({
      imports: [EquipmentDetailsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: testEquipment.id }) } } },
        { provide: InventoryApiService, useValue: {
          getEquipment: () => of(testEquipment), getEquipmentTypes: () => of([testEquipmentType]),
          listMaintenance: () => of({ items: [testMaintenance], page: 1, pageSize: 50, total: 1, totalPages: 1 }),
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentDetailsComponent);

    await fixture.whenStable();

    const content = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(content).toContain('DSIN Radar X');
    expect(content).toContain('Rua Central, 100');
    expect(content).toContain('Limite de velocidade');
    expect(content).toContain('Inspeção de rotina');
  });

  it('reports deactivation failures and allows retrying the action', async () => {
    const deactivateEquipment = vi.fn(() => throwError(() => ({ status: 409, error: { message: 'Há uma manutenção em andamento.' } })));
    await TestBed.configureTestingModule({
      imports: [EquipmentDetailsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: testEquipment.id }) } } },
        { provide: InventoryApiService, useValue: {
          getEquipment: () => of(testEquipment), getEquipmentTypes: () => of([testEquipmentType]),
          listMaintenance: () => of({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }),
          deactivateEquipment,
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentDetailsComponent);

    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.button--danger-outline')?.click();
    await fixture.whenStable();

    expect(deactivateEquipment).toHaveBeenCalledWith(testEquipment.id);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Há uma manutenção em andamento.');
    expect(TestBed.inject(Router).url).not.toContain('/equipments');
  });

  it('rejects a missing equipment id without issuing requests', async () => {
    const getEquipment = vi.fn(() => of(testEquipment));
    await TestBed.configureTestingModule({
      imports: [EquipmentDetailsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getEquipment, getEquipmentTypes: () => of([testEquipmentType]),
          listMaintenance: () => of({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }),
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentDetailsComponent);
    await fixture.whenStable();
    (fixture.componentInstance as unknown as { deactivate(): void }).deactivate();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Identificador do equipamento inválido.');
    expect(getEquipment).not.toHaveBeenCalled();
  });

  it('shows a safe API error when equipment details cannot be loaded', async () => {
    await TestBed.configureTestingModule({
      imports: [EquipmentDetailsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: testEquipment.id }) } } },
        { provide: InventoryApiService, useValue: {
          getEquipment: () => throwError(() => new Error('private equipment failure')),
          getEquipmentTypes: () => of([testEquipmentType]),
          listMaintenance: () => of({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }),
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentDetailsComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).not.toContain('private equipment failure');
  });

  it('navigates back to inventory after successful deactivation', async () => {
    const deactivateEquipment = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [EquipmentDetailsComponent],
      providers: [
        provideRouter([{ path: 'equipments', component: EquipmentsRouteStub }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: testEquipment.id }) } } },
        { provide: InventoryApiService, useValue: {
          getEquipment: () => of(testEquipment), getEquipmentTypes: () => of([testEquipmentType]),
          listMaintenance: () => of({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }),
          deactivateEquipment,
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentDetailsComponent);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.button--danger-outline')?.click();
    await fixture.whenStable();

    expect(deactivateEquipment).toHaveBeenCalledWith(testEquipment.id);
    expect(TestBed.inject(Router).url).toBe('/equipments');
  });
});
