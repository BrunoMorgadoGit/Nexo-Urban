import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, applyWhen, form, max, maxLength, min, pattern, required, submit } from '@angular/forms/signals';
import type { EquipmentContract, EquipmentStatus, EquipmentTypeContract, MaintenancePriority, OrganizationContract, RegionContract } from '@fogo/contracts';
import { InventoryApiService, apiErrorMessage, type EquipmentWriteInput } from '../core/inventory-api.service';
import { dateTimeToLocalInputValue, localDateTimeInputValue } from '../core/date-time';
import { forkJoin, firstValueFrom, of } from 'rxjs';

type EquipmentCharacteristicsForm = Record<string, string | number | boolean> & {
  speedLimitKmh: number; lanes: number; technology: string;
  resolution: string; nightVision: boolean; panTiltZoom: boolean;
  maxWeightKg: number; precisionKg: number;
  vehicleClass: string; plate: string; radioCode: string;
  laneCount: number; maxOpeningSeconds: number; accessMode: string;
  passengerCapacity: number; accessible: boolean;
  screenInches: number; network: string;
  batteryCapacityWh: number; topSpeedKmh: number; engineCapacityCc: number;
};

type EquipmentEditorModel = {
  typeCode: string;
  serialNumber: string;
  brand: string;
  model: string;
  organizationId: string;
  status: EquipmentStatus;
  maintenancePriority: MaintenancePriority;
  nextMaintenanceDate: string;
  characteristics: EquipmentCharacteristicsForm;
  location: {
    postalCode: string;
    street: string;
    reference: string;
    regionId: string;
    latitude: number;
    longitude: number;
  };
  lastPosition: { latitude: number; longitude: number; recordedAt: string };
};

const booleanCharacteristicKeys = ['nightVision', 'panTiltZoom', 'accessible'] as const;
const stringCharacteristicKeys = [
  'technology', 'resolution', 'vehicleClass', 'plate', 'radioCode', 'accessMode', 'network',
] as const;
const numberCharacteristicKeys = [
  'speedLimitKmh', 'lanes', 'maxWeightKg', 'precisionKg', 'laneCount', 'maxOpeningSeconds',
  'passengerCapacity', 'screenInches', 'batteryCapacityWh', 'topSpeedKmh', 'engineCapacityCc',
] as const;

type BooleanCharacteristicKey = typeof booleanCharacteristicKeys[number];
type StringCharacteristicKey = typeof stringCharacteristicKeys[number];
type NumberCharacteristicKey = typeof numberCharacteristicKeys[number];

function isBooleanCharacteristicKey(key: string): key is BooleanCharacteristicKey {
  return (booleanCharacteristicKeys as readonly string[]).includes(key);
}

function isStringCharacteristicKey(key: string): key is StringCharacteristicKey {
  return (stringCharacteristicKeys as readonly string[]).includes(key);
}

function isNumberCharacteristicKey(key: string): key is NumberCharacteristicKey {
  return (numberCharacteristicKeys as readonly string[]).includes(key);
}

function emptyCharacteristics(): EquipmentCharacteristicsForm {
  return {
    speedLimitKmh: 50, lanes: 1, technology: '',
    resolution: '', nightVision: false, panTiltZoom: false,
    maxWeightKg: 1000, precisionKg: 1,
    vehicleClass: '', plate: '', radioCode: '',
    laneCount: 1, maxOpeningSeconds: 1, accessMode: '',
    passengerCapacity: 1, accessible: false,
    screenInches: 7, network: '',
    batteryCapacityWh: 1, topSpeedKmh: 1, engineCapacityCc: 50,
  };
}

function emptyModel(): EquipmentEditorModel {
  return {
    typeCode: '', serialNumber: '', brand: '', model: '', organizationId: '',
    status: 'operational', maintenancePriority: 'normal', nextMaintenanceDate: '',
    characteristics: emptyCharacteristics(),
    location: { postalCode: '', street: '', reference: '', regionId: '', latitude: 91, longitude: 181 },
    lastPosition: { latitude: 91, longitude: 181, recordedAt: localDateTimeInputValue() },
  };
}

@Component({
  selector: 'app-equipment-editor',
  imports: [FormField, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equipment-editor.component.html',
  styleUrl: './equipment-editor.component.scss',
})
export class EquipmentEditorComponent {
  private readonly api = inject(InventoryApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly id = this.route.snapshot.paramMap.get('id');

  protected readonly model = signal(emptyModel());
  protected readonly equipmentForm = form(this.model, (schema) => {
    required(schema.typeCode, { message: 'Selecione o tipo de equipamento.' });
    required(schema.serialNumber, { message: 'Informe o número de série.' });
    maxLength(schema.serialNumber, 80);
    required(schema.brand, { message: 'Informe a marca.' });
    required(schema.model, { message: 'Informe o modelo.' });
    required(schema.organizationId, { message: 'Selecione o órgão responsável.' });
    required(schema.status);
    required(schema.maintenancePriority);
    required(schema.location.postalCode, { message: 'Informe o CEP.' });
    pattern(schema.location.postalCode, /^\d{5}-?\d{3}$/, { message: 'Informe um CEP válido.' });
    required(schema.location.street, { message: 'Informe a rua ou via.' });
    maxLength(schema.location.street, 160);
    required(schema.location.reference, { message: 'Informe o número ou uma referência.' });
    required(schema.location.regionId, { message: 'Selecione o bairro.' });
    min(schema.location.latitude, -90);
    max(schema.location.latitude, 90);
    min(schema.location.longitude, -180);
    max(schema.location.longitude, 180);
    applyWhen(schema, (context) => context.valueOf(schema.nextMaintenanceDate) !== '', (formSchema) => {
      pattern(formSchema.nextMaintenanceDate, /^\d{4}-\d{2}-\d{2}$/, { message: 'Informe uma data válida.' });
    });
    applyWhen(schema, (context) => context.valueOf(schema.typeCode) === 'speed_radar', (formSchema) => {
      min(formSchema.characteristics.speedLimitKmh, 20); max(formSchema.characteristics.speedLimitKmh, 130);
      min(formSchema.characteristics.lanes, 1); max(formSchema.characteristics.lanes, 8);
      required(formSchema.characteristics.technology);
    });
    applyWhen(schema, (context) => context.valueOf(schema.typeCode) === 'surveillance_camera', (formSchema) => {
      required(formSchema.characteristics.resolution);
    });
    applyWhen(schema, (context) => context.valueOf(schema.typeCode) === 'weighbridge', (formSchema) => {
      min(formSchema.characteristics.maxWeightKg, 1000); max(formSchema.characteristics.maxWeightKg, 120000);
      min(formSchema.characteristics.precisionKg, 0.1); max(formSchema.characteristics.precisionKg, 10);
    });
    applyWhen(schema, (context) => ['enforcement_vehicle', 'patrol_vehicle', 'motorcycle'].includes(context.valueOf(schema.typeCode)), (formSchema) => {
      required(formSchema.characteristics.plate);
      pattern(formSchema.characteristics.plate, /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, { message: 'Use uma placa sintética no padrão ABC1D23.' });
      required(formSchema.characteristics.radioCode);
    });
    applyWhen(schema, (context) => ['enforcement_vehicle', 'patrol_vehicle'].includes(context.valueOf(schema.typeCode)), (formSchema) => {
      required(formSchema.characteristics.vehicleClass);
    });
    applyWhen(schema, (context) => context.valueOf(schema.typeCode) === 'access_barrier', (formSchema) => {
      min(formSchema.characteristics.laneCount, 1); max(formSchema.characteristics.laneCount, 12);
      min(formSchema.characteristics.maxOpeningSeconds, 1); max(formSchema.characteristics.maxOpeningSeconds, 120);
      required(formSchema.characteristics.accessMode);
    });
    applyWhen(schema, (context) => context.valueOf(schema.typeCode) === 'transit_vehicle', (formSchema) => {
      required(formSchema.characteristics.vehicleClass);
      min(formSchema.characteristics.passengerCapacity, 1); max(formSchema.characteristics.passengerCapacity, 300);
    });
    applyWhen(schema, (context) => context.valueOf(schema.typeCode) === 'service_kiosk', (formSchema) => {
      min(formSchema.characteristics.screenInches, 7); max(formSchema.characteristics.screenInches, 65);
      required(formSchema.characteristics.network);
    });
    applyWhen(schema, (context) => context.valueOf(schema.typeCode) === 'scooter', (formSchema) => {
      min(formSchema.characteristics.batteryCapacityWh, 1); max(formSchema.characteristics.batteryCapacityWh, 1500);
      min(formSchema.characteristics.topSpeedKmh, 1); max(formSchema.characteristics.topSpeedKmh, 45);
    });
    applyWhen(schema, (context) => ['enforcement_vehicle', 'transit_vehicle', 'scooter', 'motorcycle', 'patrol_vehicle'].includes(context.valueOf(schema.typeCode)), (formSchema) => {
      min(formSchema.lastPosition.latitude, -90); max(formSchema.lastPosition.latitude, 90);
      min(formSchema.lastPosition.longitude, -180); max(formSchema.lastPosition.longitude, 180);
      required(formSchema.lastPosition.recordedAt);
    });
  });

  protected readonly types = signal<EquipmentTypeContract[]>([]);
  protected readonly organizations = signal<OrganizationContract[]>([]);
  protected readonly regions = signal<RegionContract[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly selectedType = computed(() => this.types().find((type) => type.code === this.model().typeCode));
  protected readonly pageTitle = this.id ? 'Editar equipamento' : 'Cadastrar equipamento';

  constructor() {
    forkJoin({
      types: this.api.getEquipmentTypes(),
      organizations: this.api.getOrganizations(),
      regions: this.api.getRegions(),
      equipment: this.id ? this.api.getEquipment(this.id) : of(null),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ types, organizations, regions, equipment }) => {
        this.types.set(types);
        this.organizations.set(organizations);
        this.regions.set(regions);
        if (equipment) this.populate(equipment);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error));
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected typeChanged(): void {
    const type = this.selectedType();
    if (!type) return;
    this.model.update((current) => ({
      ...current,
      characteristics: { ...emptyCharacteristics() },
      location: { ...current.location, latitude: 91, longitude: 181 },
      lastPosition: { latitude: 91, longitude: 181, recordedAt: localDateTimeInputValue() },
    }));
  }

  protected characteristicField(key: string) {
    return this.equipmentForm.characteristics[key];
  }

  protected booleanCharacteristicField(key: string) {
    if (!isBooleanCharacteristicKey(key)) throw new Error('Unsupported boolean characteristic field.');
    return this.equipmentForm.characteristics[key];
  }

  protected stringCharacteristicField(key: string) {
    if (!isStringCharacteristicKey(key)) throw new Error('Unsupported text characteristic field.');
    return this.equipmentForm.characteristics[key];
  }

  protected numberCharacteristicField(key: string) {
    if (!isNumberCharacteristicKey(key)) throw new Error('Unsupported numeric characteristic field.');
    return this.equipmentForm.characteristics[key];
  }

  protected characteristicInvalid(key: string): boolean {
    const field = this.equipmentForm.characteristics[key]();
    return field.touched() && field.invalid();
  }

  protected characteristicError(key: string): string {
    const field = this.equipmentForm.characteristics[key]();
    return field.errors()[0]?.message ?? 'Revise este valor.';
  }

  protected locationCity(): string {
    return this.regions().find(({ id }) => id === this.model().location.regionId)?.city ?? '';
  }

  protected locationState(): string {
    return this.regions().find(({ id }) => id === this.model().location.regionId)?.state ?? '';
  }

  protected characteristicOptionLabel(option: string): string {
    return ({
      doppler: 'Doppler',
      sectional: 'Por trecho',
      '2k': '2K',
      '4k': '4K',
      sedan: 'Sedã',
      pickup: 'Picape',
      van: 'Van',
      bus: 'Ônibus',
      light_rail: 'VLT',
      tag: 'Tag',
      plate: 'Placa',
      manual: 'Manual',
      ethernet: 'Ethernet',
      wifi: 'Wi-Fi',
      cellular: 'Rede móvel',
    } as Record<string, string>)[option] ?? option;
  }

  protected save(): void {
    this.error.set('');
    void submit(this.equipmentForm, async () => {
      const type = this.selectedType();
      const region = this.regions().find(({ id }) => id === this.model().location.regionId);
      const organization = this.organizations().find(({ id }) => id === this.model().organizationId);
      if (!type || !region || !organization) {
        this.error.set('Selecione tipo, bairro e órgão válidos.');
        return;
      }
      const current = this.model();
      const characteristics: EquipmentWriteInput['characteristics'] = {};
      for (const { key } of type.characteristics) {
        characteristics[key] = current.characteristics[key];
      }
      const input: EquipmentWriteInput = {
        typeCode: type.code,
        serialNumber: current.serialNumber.trim(),
        brand: current.brand.trim(),
        model: current.model.trim(),
        organizationId: current.organizationId,
        status: current.status,
        maintenancePriority: current.maintenancePriority,
        nextMaintenanceDate: current.nextMaintenanceDate || null,
        characteristics,
        location: {
          postalCode: current.location.postalCode,
          street: current.location.street,
          reference: current.location.reference,
          regionId: region.id,
          city: region.city,
          state: region.state,
          latitude: current.location.latitude,
          longitude: current.location.longitude,
          role: type.mobility === 'mobile' ? 'base' : 'fixed',
        },
      };
      if (type.mobility === 'mobile') {
        input.lastPosition = {
          latitude: current.lastPosition.latitude,
          longitude: current.lastPosition.longitude,
          recordedAt: new Date(current.lastPosition.recordedAt).toISOString(),
        };
      }

      this.saving.set(true);
      try {
        const saved = this.id
          ? await firstValueFrom(this.api.updateEquipment(this.id, input))
          : await firstValueFrom(this.api.createEquipment(input));
        await this.router.navigate(['/equipments', saved.id], { state: { notice: 'Equipamento salvo com sucesso.' } });
      } catch (error: unknown) {
        this.error.set(apiErrorMessage(error));
      } finally {
        this.saving.set(false);
      }
    });
  }

  private populate(equipment: EquipmentContract): void {
    const characteristics = { ...emptyCharacteristics(), ...equipment.characteristics };
    this.model.set({
      typeCode: equipment.typeCode,
      serialNumber: equipment.serialNumber,
      brand: equipment.brand,
      model: equipment.model,
      organizationId: equipment.organizationId,
      status: equipment.status,
      maintenancePriority: equipment.maintenancePriority,
      nextMaintenanceDate: equipment.nextMaintenanceDate ?? '',
      characteristics,
      location: {
        postalCode: equipment.location.postalCode,
        street: equipment.location.street,
        reference: equipment.location.reference,
        regionId: equipment.location.regionId,
        latitude: equipment.location.latitude,
        longitude: equipment.location.longitude,
      },
      lastPosition: equipment.lastPosition
        ? {
            latitude: equipment.lastPosition.latitude,
            longitude: equipment.lastPosition.longitude,
            recordedAt: dateTimeToLocalInputValue(equipment.lastPosition.recordedAt),
          }
        : { latitude: 91, longitude: 181, recordedAt: localDateTimeInputValue() },
    });
  }
}
