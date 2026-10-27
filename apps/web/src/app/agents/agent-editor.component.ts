import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, applyWhen, form, max, maxLength, min, minLength, required, submit } from '@angular/forms/signals';
import type { AgentAvailability, AgentCategory, AgentContract, EquipmentContract, OperationalBaseContract, OrganizationContract, RegionContract } from '@fogo/contracts';
import { InventoryApiService, type AgentWriteInput } from '../core/inventory-api.service';
import { apiErrorMessage } from '../core/api-error-message';
import { ErrorFeedback } from '../shared/error-feedback/error-feedback';
import { dateTimeToLocalInputValue, localDateTimeInputValue } from '../core/date-time';
import { firstValueFrom, forkJoin, of } from 'rxjs';

type AgentEditorModel = {
  name: string;
  identifier: string;
  category: AgentCategory;
  organizationId: string;
  availability: AgentAvailability;
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

type EquipmentOption = Pick<EquipmentContract, 'id' | 'serialNumber'> & { label: string };

function initialModel(): AgentEditorModel {
  return {
    name: '',
    identifier: '',
    category: 'traffic_agent',
    organizationId: '',
    availability: 'available',
    includePosition: false,
    position: { latitude: 91, longitude: 181, recordedAt: localDateTimeInputValue(), regionId: '' },
    operationalBaseSelection: '',
    newBaseName: '',
    newBaseRegionId: '',
    newBaseLatitude: '',
    newBaseLongitude: '',
    equipmentId: '',
    operationalNotes: '',
  };
}

@Component({
  selector: 'app-agent-editor',
  imports: [FormField, RouterLink, ErrorFeedback],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-editor.component.html',
  styleUrl: './agent-editor.component.scss',
})
export class AgentEditorComponent {
  private readonly api = inject(InventoryApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly id = this.route.snapshot.paramMap.get('id');

  protected readonly model = signal(initialModel());
  protected readonly agentForm = form(this.model, (schema) => {
    required(schema.name, { message: 'Informe um nome demonstrativo.' });
    minLength(schema.name, 2);
    maxLength(schema.name, 100);
    required(schema.identifier, { message: 'Informe a identificação funcional.' });
    minLength(schema.identifier, 2);
    maxLength(schema.identifier, 40);
    required(schema.category);
    required(schema.organizationId, { message: 'Selecione o órgão responsável.' });
    required(schema.availability);
    maxLength(schema.operationalNotes, 500);
    applyWhen(schema, (context) => context.valueOf(schema.includePosition), (formSchema) => {
      min(formSchema.position.latitude, -90); max(formSchema.position.latitude, 90);
      min(formSchema.position.longitude, -180); max(formSchema.position.longitude, 180);
      required(formSchema.position.recordedAt, { message: 'Informe quando a posição foi registrada.' });
    });
    applyWhen(schema, (context) => context.valueOf(schema.operationalBaseSelection) === 'new', (formSchema) => {
      required(formSchema.newBaseName, { message: 'Informe o nome da base operacional.' });
      minLength(formSchema.newBaseName, 2);
      maxLength(formSchema.newBaseName, 120);
    });
  });
  protected readonly organizations = signal<OrganizationContract[]>([]);
  protected readonly regions = signal<RegionContract[]>([]);
  protected readonly operationalBases = signal<OperationalBaseContract[]>([]);
  protected readonly equipmentOptions = signal<EquipmentOption[]>([]);
  protected readonly equipmentSearch = signal('');
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly pageTitle = this.id ? 'Editar agente' : 'Cadastrar agente';
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
    forkJoin({
      organizations: this.api.getOrganizations(),
      regions: this.api.getRegions(),
      operationalBases: this.api.getOperationalBases(),
      equipment: this.api.listEquipment({ pageSize: 20 }),
      agent: this.id ? this.api.getAgent(this.id) : of(null),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ organizations, regions, operationalBases, equipment, agent }) => {
        this.organizations.set(organizations);
        this.regions.set(regions);
        this.operationalBases.set(operationalBases);
        this.equipmentOptions.set(equipment.items.map((item) => ({
          id: item.id,
          serialNumber: item.serialNumber,
          label: `${item.typeLabel} · ${item.brand} ${item.model} · ${item.serialNumber}`,
        })));
        if (agent) this.populate(agent);
        if (agent?.linkedEquipment && !this.equipmentOptions().some(({ id }) => id === agent.linkedEquipment?.id)) {
          this.equipmentOptions.update((items) => [...items, {
            id: agent.linkedEquipment!.id,
            serialNumber: agent.linkedEquipment!.serialNumber,
            label: agent.linkedEquipment!.label,
          }]);
        }
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error));
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected save(): void {
    this.error.set('');
    const current = this.model();
    if (current.operationalBaseSelection === 'new') {
      const latitude = current.newBaseLatitude.trim() ? Number(current.newBaseLatitude) : undefined;
      const longitude = current.newBaseLongitude.trim() ? Number(current.newBaseLongitude) : undefined;
      if (current.newBaseName.trim().length < 2) {
        this.error.set('Informe o nome da base operacional.');
        return;
      }
      if (current.newBaseRegionId && !this.regions().some(({ id }) => id === current.newBaseRegionId)) {
        this.error.set('Selecione uma região válida para a base.');
        return;
      }
      if ((latitude === undefined) !== (longitude === undefined)) {
        this.error.set('Informe latitude e longitude da base juntas.');
        return;
      }
      if (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
        this.error.set('A latitude da base deve estar entre -90 e 90.');
        return;
      }
      if (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
        this.error.set('A longitude da base deve estar entre -180 e 180.');
        return;
      }
    } else if (current.operationalBaseSelection && !this.operationalBases().some(({ id }) => id === current.operationalBaseSelection)) {
      this.error.set('Selecione uma base operacional válida.');
      return;
    }
    if (current.equipmentId && !this.equipmentOptions().some(({ id }) => id === current.equipmentId)) {
      this.error.set('Selecione um equipamento existente no inventário.');
      return;
    }
    void submit(this.agentForm, async () => {
      if (!this.organizations().some(({ id }) => id === current.organizationId)) {
        this.error.set('Selecione um órgão responsável válido.');
        return;
      }
      const input: AgentWriteInput = {
        name: current.name.trim(),
        identifier: current.identifier.trim().toUpperCase(),
        category: current.category,
        organizationId: current.organizationId,
        availability: current.availability,
        operationalBaseId: current.operationalBaseSelection && current.operationalBaseSelection !== 'new'
          ? current.operationalBaseSelection
          : null,
        equipmentId: current.equipmentId || null,
        operationalNotes: current.operationalNotes.trim() || null,
      };
      if (current.operationalBaseSelection === 'new') {
        input.newOperationalBase = {
          name: current.newBaseName.trim(),
          ...(current.newBaseRegionId ? { regionId: current.newBaseRegionId } : {}),
          ...(current.newBaseLatitude.trim() ? { latitude: Number(current.newBaseLatitude) } : {}),
          ...(current.newBaseLongitude.trim() ? { longitude: Number(current.newBaseLongitude) } : {}),
        };
        delete input.operationalBaseId;
      }
      if (current.includePosition) {
        input.position = {
          latitude: current.position.latitude,
          longitude: current.position.longitude,
          recordedAt: new Date(current.position.recordedAt).toISOString(),
          ...(current.position.regionId ? { regionId: current.position.regionId } : {}),
        };
      }
      this.saving.set(true);
      try {
        const saved = this.id
          ? await firstValueFrom(this.api.updateAgent(this.id, input))
          : await firstValueFrom(this.api.createAgent(input));
        await this.router.navigate(['/agents', saved.id], { state: { notice: 'Agente salvo com sucesso.' } });
      } catch (error: unknown) {
        this.error.set(apiErrorMessage(error));
      } finally {
        this.saving.set(false);
      }
    });
  }

  private populate(agent: AgentContract): void {
    this.model.set({
      name: agent.name,
      identifier: agent.identifier,
      category: agent.category,
      organizationId: agent.organizationId,
      availability: agent.availability,
      includePosition: agent.position !== null,
      position: agent.position
        ? { ...agent.position, regionId: agent.position.regionId ?? '', recordedAt: dateTimeToLocalInputValue(agent.position.recordedAt) }
        : initialModel().position,
      operationalBaseSelection: agent.operationalBase?.id ?? '',
      newBaseName: '',
      newBaseRegionId: '',
      newBaseLatitude: '',
      newBaseLongitude: '',
      equipmentId: agent.linkedEquipment?.id ?? '',
      operationalNotes: agent.operationalNotes ?? '',
    });
  }

  protected equipmentSearchChanged(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    const search = event.target.value.trim();
    this.equipmentSearch.set(event.target.value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = undefined;
      this.api.listEquipment({ search, pageSize: 20 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (page) => {
          const selected = this.equipmentOptions().find(({ id }) => id === this.model().equipmentId);
          const results = page.items.map((item) => ({
            id: item.id,
            serialNumber: item.serialNumber,
            label: `${item.typeLabel} · ${item.brand} ${item.model} · ${item.serialNumber}`,
          }));
          this.equipmentOptions.set(selected && !results.some(({ id }) => id === selected.id) ? [selected, ...results] : results);
        },
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
    }, 280);
  }

  protected categoryLabel(category: string): string {
    return ({
      traffic_agent: 'Agente de trânsito', municipal_guard: 'Guarda municipal', police_officer: 'Policial',
      military_police_officer: 'Policial militar', civil_police_officer: 'Policial civil', other: 'Outro',
    } as Record<string, string>)[category] ?? category;
  }
}
