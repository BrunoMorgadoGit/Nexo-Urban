import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, applyWhen, form, max, maxLength, min, minLength, required, submit } from '@angular/forms/signals';
import type { AgentAvailability, AgentCategory, AgentContract, OrganizationContract } from '@fogo/contracts';
import { InventoryApiService, apiErrorMessage, type AgentWriteInput } from '../core/inventory-api.service';
import { dateTimeToLocalInputValue, localDateTimeInputValue } from '../core/date-time';
import { firstValueFrom, forkJoin, of } from 'rxjs';

type AgentEditorModel = {
  name: string;
  identifier: string;
  category: AgentCategory;
  organizationId: string;
  availability: AgentAvailability;
  includePosition: boolean;
  position: { latitude: number; longitude: number; recordedAt: string };
};

function initialModel(): AgentEditorModel {
  return {
    name: '',
    identifier: '',
    category: 'traffic_agent',
    organizationId: '',
    availability: 'available',
    includePosition: false,
    position: { latitude: 91, longitude: 181, recordedAt: localDateTimeInputValue() },
  };
}

@Component({
  selector: 'app-agent-editor',
  imports: [FormField, RouterLink],
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
    applyWhen(schema, (context) => context.valueOf(schema.includePosition), (formSchema) => {
      min(formSchema.position.latitude, -90); max(formSchema.position.latitude, 90);
      min(formSchema.position.longitude, -180); max(formSchema.position.longitude, 180);
      required(formSchema.position.recordedAt, { message: 'Informe quando a posição foi registrada.' });
    });
  });
  protected readonly organizations = signal<OrganizationContract[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly pageTitle = this.id ? 'Editar agente' : 'Cadastrar agente';

  constructor() {
    forkJoin({
      organizations: this.api.getOrganizations(),
      agent: this.id ? this.api.getAgent(this.id) : of(null),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ organizations, agent }) => {
        this.organizations.set(organizations);
        if (agent) this.populate(agent);
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
    void submit(this.agentForm, async () => {
      const current = this.model();
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
      };
      if (current.includePosition) {
        input.position = {
          latitude: current.position.latitude,
          longitude: current.position.longitude,
          recordedAt: new Date(current.position.recordedAt).toISOString(),
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
        ? { ...agent.position, recordedAt: dateTimeToLocalInputValue(agent.position.recordedAt) }
        : initialModel().position,
    });
  }
}
