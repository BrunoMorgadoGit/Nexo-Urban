import { type Signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { EquipmentTypeContract } from '@fogo/contracts';
import { InventoryApiService } from '../core/inventory-api.service';
import { ViaCepResult, ViaCepService } from '../core/viacep.service';
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
  cepLoading: Signal<boolean>;
  cepFeedback: Signal<{ type: string; message: string } | null>;
  locationCity(): string;
  locationState(): string;
  save(): void;
  typeChanged(): void;
  searchCep(explicitCep?: string): void;
  onPostalCodeInput(event: Event): void;
  findMatchingRegion(neighborhood: string, city?: string, state?: string): unknown;
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

const defaultMockViaCep = {
  cleanCep: (cep: string) => (cep ?? '').replace(/\D/g, ''),
  isValidCep: (cep: string) => /^\d{8}$/.test((cep ?? '').replace(/\D/g, '')),
  formatCep: (cep: string) => {
    const c = (cep ?? '').replace(/\D/g, '');
    return c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : cep;
  },
  lookupCep: vi.fn((_cep: string) => of(null)),
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
        { provide: ViaCepService, useValue: defaultMockViaCep },
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
        { provide: ViaCepService, useValue: defaultMockViaCep },
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
        { provide: ViaCepService, useValue: defaultMockViaCep },
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
        { provide: ViaCepService, useValue: defaultMockViaCep },
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
        { provide: ViaCepService, useValue: defaultMockViaCep },
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
        { provide: ViaCepService, useValue: defaultMockViaCep },
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

  describe('ViaCEP and OpenStreetMap integration for location autocompletion', () => {
    it('autocompletes street, region, city/state, latitude and longitude when valid CEP is entered', async () => {
      const mockResult: ViaCepResult = {
        postalCode: '13010-000',
        street: 'Praça Bento Quirino',
        neighborhood: 'Sousas',
        city: 'Campinas',
        state: 'SP',
        complement: 'lado ímpar',
        latitude: -22.881229,
        longitude: -46.969887,
      };
      const lookupCep = vi.fn(() => of(mockResult));
      const viaCepMock = { ...defaultMockViaCep, lookupCep };

      await TestBed.configureTestingModule({
        imports: [EquipmentEditorComponent],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
          { provide: InventoryApiService, useValue: {
            getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]), getRegions: () => of([testRegion]),
          } },
          { provide: ViaCepService, useValue: viaCepMock },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(EquipmentEditorComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance as unknown as EquipmentEditorHarness;

      component.model.update((current) => ({
        ...current,
        location: { ...current.location, postalCode: '13010-000' },
      }));
      component.searchCep();
      await fixture.whenStable();

      expect(lookupCep).toHaveBeenCalledWith('13010000');
      expect(component.model().location.street).toBe('Praça Bento Quirino');
      expect(component.model().location.regionId).toBe(testRegion.id);
      expect(component.model().location.latitude).toBe(-22.881229);
      expect(component.model().location.longitude).toBe(-46.969887);
      expect(component.locationCity()).toBe('Campinas');
      expect(component.locationState()).toBe('SP');
      expect(component.cepFeedback()?.type).toBe('success');
      expect(component.cepFeedback()?.message).toContain('Endereço e coordenadas localizados');
    });

    it('asks for manual coordinates when the address is found but geocoding has no result', async () => {
      const mockResult: ViaCepResult = {
        postalCode: '13010-000',
        street: 'Praça Bento Quirino',
        neighborhood: 'Sousas',
        city: 'Campinas',
        state: 'SP',
        complement: '',
      };
      const lookupCep = vi.fn(() => of(mockResult));
      const viaCepMock = { ...defaultMockViaCep, lookupCep };

      await TestBed.configureTestingModule({
        imports: [EquipmentEditorComponent],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
          { provide: InventoryApiService, useValue: {
            getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]), getRegions: () => of([testRegion]),
          } },
          { provide: ViaCepService, useValue: viaCepMock },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(EquipmentEditorComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance as unknown as EquipmentEditorHarness;

      component.searchCep('13010-000');
      await fixture.whenStable();

      expect(component.model().location.regionId).toBe(testRegion.id);
      expect(component.cepFeedback()?.type).toBe('info');
      expect(component.cepFeedback()?.message).toContain('Informe as coordenadas manualmente');
    });

    it('shows error feedback when CEP is not found on ViaCEP', async () => {
      const lookupCep = vi.fn(() => of(null));
      const viaCepMock = { ...defaultMockViaCep, lookupCep };

      await TestBed.configureTestingModule({
        imports: [EquipmentEditorComponent],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
          { provide: InventoryApiService, useValue: {
            getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]), getRegions: () => of([testRegion]),
          } },
          { provide: ViaCepService, useValue: viaCepMock },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(EquipmentEditorComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance as unknown as EquipmentEditorHarness;

      component.searchCep('99999999');
      await fixture.whenStable();

      expect(lookupCep).toHaveBeenCalledWith('99999999');
      expect(component.cepFeedback()?.type).toBe('error');
      expect(component.cepFeedback()?.message).toContain('CEP não encontrado');
    });

    it('shows informative feedback and uses fallback city/state when neighborhood does not match any region', async () => {
      const mockResult: ViaCepResult = {
        postalCode: '01001-000',
        street: 'Praça da Sé',
        neighborhood: 'Sé',
        city: 'São Paulo',
        state: 'SP',
        complement: 'lado ímpar',
      };
      const lookupCep = vi.fn(() => of(mockResult));
      const viaCepMock = { ...defaultMockViaCep, lookupCep };

      await TestBed.configureTestingModule({
        imports: [EquipmentEditorComponent],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
          { provide: InventoryApiService, useValue: {
            getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]), getRegions: () => of([testRegion]),
          } },
          { provide: ViaCepService, useValue: viaCepMock },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(EquipmentEditorComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance as unknown as EquipmentEditorHarness;

      component.searchCep('01001-000');
      await fixture.whenStable();

      expect(component.model().location.street).toBe('Praça da Sé');
      expect(component.model().location.regionId).toBe('');
      expect(component.locationCity()).toBe('São Paulo');
      expect(component.locationState()).toBe('SP');
      expect(component.cepFeedback()?.type).toBe('info');
      expect(component.cepFeedback()?.message).toContain('Sé');
    });

    it('handles network failure gracefully', async () => {
      const lookupCep = vi.fn(() => throwError(() => new Error('Offline')));
      const viaCepMock = { ...defaultMockViaCep, lookupCep };

      await TestBed.configureTestingModule({
        imports: [EquipmentEditorComponent],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
          { provide: InventoryApiService, useValue: {
            getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]), getRegions: () => of([testRegion]),
          } },
          { provide: ViaCepService, useValue: viaCepMock },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(EquipmentEditorComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance as unknown as EquipmentEditorHarness;

      component.searchCep('13010-000');
      await fixture.whenStable();

      expect(component.cepFeedback()?.type).toBe('error');
      expect(component.cepFeedback()?.message).toContain('Não foi possível consultar o CEP');
    });

    it('requires 8 digits before querying ViaCEP', async () => {
      const lookupCep = vi.fn(() => of(null));
      const viaCepMock = { ...defaultMockViaCep, lookupCep };

      await TestBed.configureTestingModule({
        imports: [EquipmentEditorComponent],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
          { provide: InventoryApiService, useValue: {
            getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]), getRegions: () => of([testRegion]),
          } },
          { provide: ViaCepService, useValue: viaCepMock },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(EquipmentEditorComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance as unknown as EquipmentEditorHarness;

      component.searchCep('12345');
      await fixture.whenStable();

      expect(lookupCep).not.toHaveBeenCalled();
      expect(component.cepFeedback()?.type).toBe('error');
      expect(component.cepFeedback()?.message).toContain('8 dígitos');
    });

    it('triggers search automatically on input event when 8 digits are entered', async () => {
      const mockResult: ViaCepResult = {
        postalCode: '13010-000',
        street: 'Praça Bento Quirino',
        neighborhood: 'Sousas',
        city: 'Campinas',
        state: 'SP',
        complement: '',
      };
      const lookupCep = vi.fn(() => of(mockResult));
      const viaCepMock = { ...defaultMockViaCep, lookupCep };

      await TestBed.configureTestingModule({
        imports: [EquipmentEditorComponent],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
          { provide: InventoryApiService, useValue: {
            getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]), getRegions: () => of([testRegion]),
          } },
          { provide: ViaCepService, useValue: viaCepMock },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(EquipmentEditorComponent);
      await fixture.whenStable();

      const inputElement = fixture.nativeElement.querySelector('input[autocomplete="postal-code"]') as HTMLInputElement;
      inputElement.value = '13010000';
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();

      expect(lookupCep).toHaveBeenCalledWith('13010000');
    });

    it('renders the Buscar button and responds to click', async () => {
      const mockResult: ViaCepResult = {
        postalCode: '13010-000',
        street: 'Praça Bento Quirino',
        neighborhood: 'Sousas',
        city: 'Campinas',
        state: 'SP',
        complement: '',
      };
      const lookupCep = vi.fn(() => of(mockResult));
      const viaCepMock = { ...defaultMockViaCep, lookupCep };

      await TestBed.configureTestingModule({
        imports: [EquipmentEditorComponent],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
          { provide: InventoryApiService, useValue: {
            getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]), getRegions: () => of([testRegion]),
          } },
          { provide: ViaCepService, useValue: viaCepMock },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(EquipmentEditorComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance as unknown as EquipmentEditorHarness;

      component.model.update((curr) => ({
        ...curr,
        location: { ...curr.location, postalCode: '13010-000' },
      }));
      fixture.detectChanges();

      const searchBtn = fixture.nativeElement.querySelector('.cep-button') as HTMLButtonElement;
      expect(searchBtn).not.toBeNull();
      expect(searchBtn.textContent).toContain('Buscar');

      searchBtn.click();
      await fixture.whenStable();

      expect(lookupCep).toHaveBeenCalledWith('13010000');
    });

    it('does not match a same-named neighborhood from another city and keeps the CEP city', async () => {
      const mockResult: ViaCepResult = {
        postalCode: '01001-000',
        street: 'Praça da Sé',
        neighborhood: 'Sousas',
        city: 'São Paulo',
        state: 'SP',
        complement: '',
        latitude: -23.55039,
        longitude: -46.633081,
      };
      const lookupCep = vi.fn(() => of(mockResult));
      const viaCepMock = { ...defaultMockViaCep, lookupCep };

      await TestBed.configureTestingModule({
        imports: [EquipmentEditorComponent],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
          { provide: InventoryApiService, useValue: {
            getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]), getRegions: () => of([testRegion]),
          } },
          { provide: ViaCepService, useValue: viaCepMock },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(EquipmentEditorComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance as unknown as EquipmentEditorHarness;

      component.searchCep('01001-000');
      await fixture.whenStable();

      expect(component.model().location.regionId).toBe('');
      expect(component.locationCity()).toBe('São Paulo');
      expect(component.locationState()).toBe('SP');
    });

    it('saves the CEP city and state even when the selected region belongs to another city', async () => {
      const createEquipment = vi.fn(() => of(testEquipment));
      const mockResult: ViaCepResult = {
        postalCode: '01001-000',
        street: 'Praça da Sé',
        neighborhood: 'Sé',
        city: 'São Paulo',
        state: 'SP',
        complement: '',
        latitude: -23.55039,
        longitude: -46.633081,
      };
      const lookupCep = vi.fn(() => of(mockResult));
      const viaCepMock = { ...defaultMockViaCep, lookupCep };

      await TestBed.configureTestingModule({
        imports: [EquipmentEditorComponent],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
          { provide: InventoryApiService, useValue: {
            getEquipmentTypes: () => of([testEquipmentType]), getOrganizations: () => of([testOrganization]),
            getRegions: () => of([testRegion]), createEquipment,
          } },
          { provide: ViaCepService, useValue: viaCepMock },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(EquipmentEditorComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance as unknown as EquipmentEditorHarness;
      const current = component.model();
      component.model.set({
        ...current,
        typeCode: testEquipmentType.code,
        serialNumber: 'RAD-900',
        brand: 'Marca',
        model: 'Modelo',
        organizationId: testOrganization.id,
        characteristics: { ...current.characteristics, speedLimitKmh: 50, technology: 'doppler' },
        location: {
          postalCode: '01001-000', street: 'Praça da Sé', reference: '100',
          regionId: testRegion.id, latitude: -23.55039, longitude: -46.633081,
        },
      });
      component.searchCep('01001-000');
      await fixture.whenStable();
      component.save();
      await fixture.whenStable();

      expect(createEquipment).toHaveBeenCalledWith(expect.objectContaining({
        location: expect.objectContaining({ city: 'São Paulo', state: 'SP', regionId: testRegion.id }),
      }));
    });
  });
});
