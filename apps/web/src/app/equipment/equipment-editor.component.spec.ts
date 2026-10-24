import { type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { EquipmentTypeContract } from '@fogo/contracts';
import { InventoryApiService } from '../core/inventory-api.service';
import { testEquipment, testEquipmentType, testOrganization, testRegion } from '../../../test-helpers/inventory-fixtures';
import { EquipmentEditorComponent } from './equipment-editor.component';

type EquipmentEditorModel = {
  typeCode: string;
  serialNumber: string;
  brand: string;
  model: string;
  organizationId: string;
  status: 'not_installed' | 'operational' | 'malfunctioning' | 'maintenance' | 'deactivated' | 'stolen';
  maintenancePriority: 'low' | 'normal' | 'high' | 'immediate';
  nextMaintenanceDate: string;
  characteristics: Record<string, string | number | boolean>;
  location: { postalCode: string; street: string; reference: string; regionId: string; latitude: number; longitude: number };
  lastPosition: { latitude: number; longitude: number; recordedAt: string };
};
type EquipmentEditorHarness = {
  model: WritableSignal<EquipmentEditorModel>;
  save(): void;
  typeChanged(): void;
  characteristicField(key: string): unknown;
  booleanCharacteristicField(key: string): unknown;
  stringCharacteristicField(key: string): unknown;
  numberCharacteristicField(key: string): unknown;
  characteristicInvalid(key: string): boolean;
  characteristicError(key: string): string;
  characteristicOptionLabel(option: string): string;
};

const scooterType: EquipmentTypeContract = {
  code: 'scooter', label: 'Patinete', mobility: 'mobile',
  characteristics: [
    { key: 'batteryCapacityWh', label: 'Bateria', kind: 'number', required: true, minimum: 1, maximum: 1500 },
    { key: 'topSpeedKmh', label: 'Velocidade máxima', kind: 'number', required: true, minimum: 1, maximum: 45 },
  ],
};

describe('EquipmentEditorComponent', () => {
  it('renders lookup options and dependent characteristics for the chosen type', async () => {
    await TestBed.configureTestingModule({
      imports: [EquipmentEditorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]), getRegions: () => of([testRegion]),
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentEditorComponent);

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const selects = root.querySelectorAll<HTMLSelectElement>('select');
    selects[1].value = testEquipmentType.code;
    selects[1].dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();

    expect(root.textContent).toContain('Radar de velocidade');
    expect(root.querySelector('input[type="number"]')).not.toBeNull();
    expect(root.textContent).toContain('Selecione um bairro');

    const regionSelect = [...root.querySelectorAll<HTMLSelectElement>('select')].find((select) => [...select.options].some((option) => option.value === testRegion.id));
    expect(regionSelect?.options.length).toBeGreaterThan(1);
    expect(regionSelect?.textContent).toContain('Sousas · Leste');
  });

  it('shows the load error state when any required lookup fails', async () => {
    await TestBed.configureTestingModule({
      imports: [EquipmentEditorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getEquipmentTypes: () => of([]), getOrganizations: () => of([testOrganization]),
          getRegions: () => throwError(() => new Error('lookup failure')),
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentEditorComponent);

    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível concluir a solicitação.');
  });

  it('builds a mobile equipment payload with its operational base and last known position', async () => {
    const createEquipment = vi.fn(() => of(testEquipment));
    await TestBed.configureTestingModule({
      imports: [EquipmentEditorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getEquipmentTypes: () => of([scooterType]), getOrganizations: () => of([testOrganization]),
          getRegions: () => of([testRegion]), createEquipment,
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentEditorComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as EquipmentEditorHarness;
    const current = component.model();
    component.model.set({
      ...current,
      typeCode: scooterType.code,
      serialNumber: ' PAT-01 ',
      brand: ' DSIN ',
      model: ' Mobilidade ',
      organizationId: testOrganization.id,
      characteristics: { ...current.characteristics, batteryCapacityWh: 500, topSpeedKmh: 25 },
      location: { ...current.location, postalCode: '13000-000', street: 'Rua Central', reference: '100', regionId: testRegion.id, latitude: -22.9, longitude: -47.06 },
      lastPosition: { latitude: -22.91, longitude: -47.07, recordedAt: '2026-10-24T12:00' },
    });
    component.save();
    await fixture.whenStable();

    expect(createEquipment).toHaveBeenCalledWith(expect.objectContaining({
      typeCode: 'scooter', serialNumber: 'PAT-01', brand: 'DSIN', model: 'Mobilidade',
      characteristics: { batteryCapacityWh: 500, topSpeedKmh: 25 },
      location: expect.objectContaining({ role: 'base', city: 'Campinas', state: 'SP' }),
      lastPosition: expect.objectContaining({ latitude: -22.91, longitude: -47.07 }),
    }));
  });

  it('rejects unsupported characteristic controls and labels known options', async () => {
    await TestBed.configureTestingModule({
      imports: [EquipmentEditorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]), getRegions: () => of([testRegion]),
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentEditorComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as EquipmentEditorHarness;

    component.typeChanged();
    component.model.update((current) => ({ ...current, typeCode: testEquipmentType.code }));
    component.typeChanged();
    expect(component.model().characteristics['speedLimitKmh']).toBe(50);
    expect(component.model().location.latitude).toBe(91);
    expect(component.booleanCharacteristicField('nightVision')).toBeDefined();
    expect(component.stringCharacteristicField('technology')).toBeDefined();
    expect(component.numberCharacteristicField('speedLimitKmh')).toBeDefined();
    expect(component.characteristicInvalid('technology')).toBe(false);
    expect(component.characteristicError('technology')).toBeTruthy();
    expect(() => component.booleanCharacteristicField('technology')).toThrow('Unsupported boolean characteristic field.');
    expect(() => component.stringCharacteristicField('speedLimitKmh')).toThrow('Unsupported text characteristic field.');
    expect(() => component.numberCharacteristicField('technology')).toThrow('Unsupported numeric characteristic field.');
    expect(component.characteristicOptionLabel('doppler')).toBe('Doppler');
    expect(component.characteristicOptionLabel('unknown')).toBe('unknown');
  });

  it('populates and updates an existing equipment record', async () => {
    const editableEquipment = { ...testEquipment, characteristics: { speedLimitKmh: 50, technology: 'doppler' } };
    const updateEquipment = vi.fn(() => of(editableEquipment));
    await TestBed.configureTestingModule({
      imports: [EquipmentEditorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: testEquipment.id }) } } },
        { provide: InventoryApiService, useValue: {
          getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]),
          getRegions: () => of([testRegion]), getEquipment: () => of(editableEquipment), updateEquipment,
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentEditorComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as EquipmentEditorHarness;
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Editar equipamento');
    component.characteristicField('speedLimitKmh');
    component.save();
    await fixture.whenStable();

    expect(updateEquipment).toHaveBeenCalledWith(testEquipment.id, expect.objectContaining({
      typeCode: 'speed_radar', characteristics: { speedLimitKmh: 50, technology: 'doppler' },
    }));
  });

  it('rejects an equipment type that is absent from lookup options', async () => {
    const createEquipment = vi.fn(() => of(testEquipment));
    await TestBed.configureTestingModule({
      imports: [EquipmentEditorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: InventoryApiService, useValue: {
          getEquipmentTypes: () => of([]), getOrganizations: () => of([testOrganization]),
          getRegions: () => of([testRegion]), createEquipment,
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EquipmentEditorComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as EquipmentEditorHarness;
    const current = component.model();
    component.model.set({
      ...current,
      typeCode: 'unknown-type', serialNumber: 'RAD-02', brand: 'DSIN', model: 'Radar', organizationId: testOrganization.id,
      location: { ...current.location, postalCode: '13000-000', street: 'Rua Central', reference: '100', regionId: testRegion.id, latitude: -22.9, longitude: -47.06 },
    });
    component.save();
    await fixture.whenStable();

    expect(createEquipment).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Selecione tipo, bairro e órgão válidos.');
  });
});
