import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { MaintenanceContract, Page } from '@fogo/contracts';
import { DataSource, Repository } from 'typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { ListMaintenanceDto } from './dto/list-maintenance.dto.js';
import { MaintenanceEntity, MaintenanceStatus } from './maintenance.entity.js';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MaintenanceEntity)
    private readonly maintenances: Repository<MaintenanceEntity>,
    @InjectRepository(EquipmentEntity)
    private readonly equipment: Repository<EquipmentEntity>,
  ) {}

  async create(input: CreateMaintenanceDto): Promise<MaintenanceContract> {
    const equipment = await this.equipment.findOne({
      where: { id: input.equipmentId },
      relations: { type: true },
    });
    if (!equipment || equipment.status === 'deactivated' || equipment.status === 'stolen') {
      throw new BadRequestException('Equipamento indisponível para agendamento.');
    }
    const record = await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(EquipmentEntity).update(equipment.id, {
        nextMaintenanceDate: input.scheduledDate,
        maintenancePriority: input.priority,
      });
      return manager.getRepository(MaintenanceEntity).save(
        manager.getRepository(MaintenanceEntity).create({
          equipmentId: equipment.id,
          equipment,
          kind: input.kind,
          status: 'scheduled',
          priority: input.priority,
          description: input.description.trim(),
          scheduledDate: input.scheduledDate,
          completedAt: null,
        }),
      );
    });
    return this.getContract(record.id);
  }

  async list(query: ListMaintenanceDto): Promise<Page<MaintenanceContract>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const builder = this.maintenances
      .createQueryBuilder('maintenance')
      .innerJoinAndSelect('maintenance.equipment', 'equipment')
      .innerJoinAndSelect('equipment.type', 'type');
    if (query.equipmentId) {
      builder.andWhere('maintenance.equipmentId = :equipmentId', { equipmentId: query.equipmentId });
    }
    if (query.status) builder.andWhere('maintenance.status = :status', { status: query.status });
    if (query.overdueOnly) {
      builder.andWhere('maintenance.scheduledDate < CURRENT_DATE')
        .andWhere('maintenance.status IN (:...activeStatuses)', {
          activeStatuses: ['scheduled', 'in_progress'],
        });
    }
    const [records, total] = await builder
      .orderBy('maintenance.scheduledDate', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      items: records.map((record) => this.toContract(record)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async overview() {
    const activeStatuses: MaintenanceStatus[] = ['scheduled', 'in_progress'];
    const [immediate, overdue, upcoming] = await Promise.all([
      this.maintenances
        .createQueryBuilder('maintenance')
        .where('maintenance.priority = :priority', { priority: 'immediate' })
        .andWhere('maintenance.status IN (:...activeStatuses)', { activeStatuses })
        .getCount(),
      this.maintenances
        .createQueryBuilder('maintenance')
        .where('maintenance.scheduledDate < CURRENT_DATE')
        .andWhere('maintenance.status IN (:...activeStatuses)', { activeStatuses })
        .getCount(),
      this.maintenances
        .createQueryBuilder('maintenance')
        .where('maintenance.scheduledDate >= CURRENT_DATE')
        .andWhere("maintenance.scheduledDate <= CURRENT_DATE + INTERVAL '14 days'")
        .andWhere('maintenance.status IN (:...activeStatuses)', { activeStatuses })
        .getCount(),
    ]);
    return { immediate, overdue, upcoming };
  }

  async updateStatus(id: string, nextStatus: MaintenanceStatus): Promise<MaintenanceContract> {
    const record = await this.maintenances.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Registro de manutenção não encontrado.');
    if (record.status === nextStatus) return this.getContract(id);
    const transitions: Record<MaintenanceStatus, MaintenanceStatus[]> = {
      scheduled: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };
    if (!transitions[record.status].includes(nextStatus)) {
      throw new ConflictException('Transição de estado de manutenção inválida.');
    }
    record.status = nextStatus;
    record.completedAt = nextStatus === 'completed' ? new Date() : null;
    await this.maintenances.save(record);
    return this.getContract(id);
  }

  private async getContract(id: string): Promise<MaintenanceContract> {
    const record = await this.maintenances.findOne({
      where: { id },
      relations: { equipment: { type: true } },
    });
    if (!record) throw new NotFoundException('Registro de manutenção não encontrado.');
    return this.toContract(record);
  }

  private toContract(record: MaintenanceEntity): MaintenanceContract {
    if (!record.equipment?.type) throw new Error('Maintenance equipment relation is incomplete');
    return {
      id: record.id,
      equipmentId: record.equipmentId,
      serialNumber: record.equipment.serialNumber,
      typeLabel: record.equipment.type.label,
      kind: record.kind,
      status: record.status,
      priority: record.priority,
      description: record.description,
      scheduledDate: record.scheduledDate,
      completedAt: record.completedAt?.toISOString() ?? null,
      overdue:
        record.scheduledDate < new Date().toISOString().slice(0, 10) &&
        ['scheduled', 'in_progress'].includes(record.status),
      createdAt: record.createdAt.toISOString(),
    };
  }
}
