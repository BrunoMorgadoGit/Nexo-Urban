import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EquipmentContract, EquipmentLocationContract, Page } from '@fogo/contracts';
import { DataSource, Repository } from 'typeorm';
import { EquipmentTypeEntity } from '../equipment-types/equipment-type.entity.js';
import { validateEquipmentCharacteristics } from '../equipment-types/equipment-characteristics.js';
import { EquipmentLocationEntity } from '../locations/equipment-location.entity.js';
import { EquipmentPositionEntity } from '../locations/equipment-position.entity.js';
import { OrganizationEntity } from '../organizations/organization.entity.js';
import { RegionEntity } from '../regions/region.entity.js';
import { CreateEquipmentDto } from './dto/create-equipment.dto.js';
import { ListEquipmentDto } from './dto/list-equipment.dto.js';
import { EquipmentEntity } from './equipment.entity.js';
import { MonitoringWriteService } from '../monitoring/monitoring-write.service.js';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(EquipmentEntity)
    private readonly equipment: Repository<EquipmentEntity>,
    @InjectRepository(EquipmentLocationEntity)
    private readonly locations: Repository<EquipmentLocationEntity>,
    @InjectRepository(EquipmentPositionEntity)
    private readonly positions: Repository<EquipmentPositionEntity>,
    @InjectRepository(EquipmentTypeEntity)
    private readonly types: Repository<EquipmentTypeEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizations: Repository<OrganizationEntity>,
    @InjectRepository(RegionEntity)
    private readonly regions: Repository<RegionEntity>,
    private readonly monitoringWrite: MonitoringWriteService,
  ) {}

  async create(input: CreateEquipmentDto): Promise<EquipmentContract> {
    const related = await this.validateRelated(input);
    const serialNumber = input.serialNumber.trim().toUpperCase();
    const exists = await this.equipment.exists({ where: { serialNumber } });
    if (exists) throw new ConflictException('Número de série já cadastrado.');

    const result = await this.dataSource.transaction(async (manager) => {
      const equipment = await manager.getRepository(EquipmentEntity).save(
        manager.getRepository(EquipmentEntity).create({
          typeCode: related.type.code,
          type: related.type,
          serialNumber,
          brand: input.brand.trim(),
          model: input.model.trim(),
          organizationId: related.organization.id,
          organization: related.organization,
          status: input.status,
          maintenancePriority: input.maintenancePriority,
          nextMaintenanceDate: input.nextMaintenanceDate || null,
          characteristics: validateEquipmentCharacteristics(input.typeCode, input.characteristics),
        }),
      );

      const location = manager.getRepository(EquipmentLocationEntity).create({
        equipmentId: equipment.id,
        equipment,
        postalCode: input.location.postalCode.replace('-', ''),
        street: input.location.street.trim(),
        reference: input.location.reference.trim(),
        regionId: related.region.id,
        region: related.region,
        city: related.region.city,
        state: related.region.state,
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        role: input.location.role,
      });
      await manager.getRepository(EquipmentLocationEntity).save(location);

      if (input.lastPosition) {
        await manager.getRepository(EquipmentPositionEntity).save(
          manager.getRepository(EquipmentPositionEntity).create({
            equipmentId: equipment.id,
            equipment,
            latitude: input.lastPosition.latitude,
            longitude: input.lastPosition.longitude,
            recordedAt: new Date(input.lastPosition.recordedAt),
          }),
        );
      }
      return equipment.id;
    });
    await this.monitoringWrite.equipmentChanged(result, null);
    return this.get(result);
  }

  async list(query: ListEquipmentDto): Promise<Page<EquipmentContract>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const builder = this.equipment
      .createQueryBuilder('equipment')
      .leftJoinAndSelect('equipment.type', 'type')
      .leftJoinAndSelect('equipment.organization', 'organization')
      .leftJoinAndSelect('equipment.location', 'location')
      .leftJoinAndSelect('location.region', 'region')
      .leftJoinAndSelect('equipment.lastPosition', 'position');

    if (query.search) {
      builder.andWhere(
        '(equipment.serialNumber ILIKE :search OR equipment.brand ILIKE :search OR equipment.model ILIKE :search OR type.label ILIKE :search OR region.name ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }
    if (query.typeCode) builder.andWhere('equipment.typeCode = :typeCode', { typeCode: query.typeCode });
    if (query.status) builder.andWhere('equipment.status = :status', { status: query.status });
    if (query.organizationId) {
      builder.andWhere('equipment.organizationId = :organizationId', { organizationId: query.organizationId });
    }
    if (query.regionId) builder.andWhere('location.regionId = :regionId', { regionId: query.regionId });

    const [records, total] = await builder
      .orderBy('equipment.updatedAt', 'DESC')
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

  async get(id: string): Promise<EquipmentContract> {
    const record = await this.equipment
      .createQueryBuilder('equipment')
      .leftJoinAndSelect('equipment.type', 'type')
      .leftJoinAndSelect('equipment.organization', 'organization')
      .leftJoinAndSelect('equipment.location', 'location')
      .leftJoinAndSelect('location.region', 'region')
      .leftJoinAndSelect('equipment.lastPosition', 'position')
      .where('equipment.id = :id', { id })
      .getOne();
    if (!record) throw new NotFoundException('Equipamento não encontrado.');
    return this.toContract(record);
  }

  async update(id: string, input: CreateEquipmentDto): Promise<EquipmentContract> {
    const current = await this.equipment.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Equipamento não encontrado.');
    const related = await this.validateRelated(input);
    const serialNumber = input.serialNumber.trim().toUpperCase();
    const duplicate = current.serialNumber !== serialNumber && await this.equipment
      .createQueryBuilder('equipment')
      .where('equipment.serialNumber = :serialNumber', { serialNumber })
      .andWhere('equipment.id <> :id', { id })
      .getExists();
    if (duplicate) {
      throw new ConflictException('Número de série já cadastrado.');
    }

    await this.dataSource.transaction(async (manager) => {
      const equipmentRepository = manager.getRepository(EquipmentEntity);
      const locationRepository = manager.getRepository(EquipmentLocationEntity);
      const positionRepository = manager.getRepository(EquipmentPositionEntity);
      await equipmentRepository.save({
        id: current.id,
        typeCode: related.type.code,
        status: input.status,
        serialNumber,
        brand: input.brand.trim(),
        model: input.model.trim(),
        organizationId: related.organization.id,
        maintenancePriority: input.maintenancePriority,
        nextMaintenanceDate: input.nextMaintenanceDate || null,
        characteristics: validateEquipmentCharacteristics(input.typeCode, input.characteristics),
      });

      const location = await locationRepository.findOne({ where: { equipmentId: id } });
      const locationValues = {
        equipmentId: id,
        postalCode: input.location.postalCode.replace('-', ''),
        street: input.location.street.trim(),
        reference: input.location.reference.trim(),
        regionId: related.region.id,
        city: related.region.city,
        state: related.region.state,
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        role: input.location.role,
      };
      await locationRepository.save(locationRepository.create({
        ...(location ? { id: location.id } : {}),
        ...locationValues,
      }));

      const position = await positionRepository.findOne({ where: { equipmentId: id } });
      if (input.lastPosition) {
        await positionRepository.save({
          ...(position ? { id: position.id } : {}),
          equipmentId: id,
          latitude: input.lastPosition.latitude,
          longitude: input.lastPosition.longitude,
          recordedAt: new Date(input.lastPosition.recordedAt),
        });
      } else if (position) {
        await positionRepository.remove(position);
      }
    });
    await this.monitoringWrite.equipmentChanged(id, current.status);
    return this.get(id);
  }

  async deactivate(id: string): Promise<EquipmentContract> {
    const equipment = await this.equipment.findOne({ where: { id } });
    if (!equipment) throw new NotFoundException('Equipamento não encontrado.');
    const previousStatus = equipment.status;
    equipment.status = 'deactivated';
    await this.equipment.save(equipment);
    await this.monitoringWrite.equipmentChanged(id, previousStatus);
    return this.get(id);
  }

  private async validateRelated(input: CreateEquipmentDto) {
    const [type, organization, region] = await Promise.all([
      this.types.findOne({ where: { code: input.typeCode } }),
      this.organizations.findOne({ where: { id: input.organizationId, isActive: true } }),
      this.regions.findOne({ where: { id: input.location.regionId } }),
    ]);
    if (!type) throw new BadRequestException('Tipo de equipamento inválido ou inativo.');
    if (!organization) throw new BadRequestException('Órgão responsável inválido ou inativo.');
    if (!region) throw new BadRequestException('Bairro ou região inválida.');
    if (region.city !== input.location.city || region.state !== input.location.state) {
      throw new BadRequestException('Cidade e UF precisam corresponder à região selecionada.');
    }
    if (type.mobility === 'fixed' && input.location.role !== 'fixed') {
      throw new BadRequestException('Equipamento fixo exige localização fixa.');
    }
    if (type.mobility === 'mobile' && input.location.role !== 'base') {
      throw new BadRequestException('Equipamento móvel exige endereço de base separado da última posição.');
    }
    if (type.mobility === 'mobile' && !input.lastPosition) {
      throw new BadRequestException('Equipamento móvel precisa informar sua última posição conhecida.');
    }
    if (type.mobility === 'fixed' && input.lastPosition) {
      throw new BadRequestException('Equipamento fixo não aceita posição móvel.');
    }
    return { type, organization, region };
  }

  private toContract(record: EquipmentEntity): EquipmentContract {
    if (!record.type || !record.organization || !record.location?.region) {
      throw new Error('Inventory relations are incomplete');
    }
    const location: EquipmentLocationContract = {
      postalCode: record.location.postalCode.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
      street: record.location.street,
      reference: record.location.reference,
      regionId: record.location.regionId,
      regionName: record.location.region.name,
      city: record.location.city,
      state: record.location.state,
      latitude: record.location.latitude,
      longitude: record.location.longitude,
      role: record.location.role,
    };
    return {
      id: record.id,
      typeCode: record.type.code,
      typeLabel: record.type.label,
      serialNumber: record.serialNumber,
      brand: record.brand,
      model: record.model,
      organizationId: record.organizationId,
      organizationName: record.organization.name,
      status: record.status,
      maintenancePriority: record.maintenancePriority,
      dataOrigin: record.dataOrigin,
      nextMaintenanceDate: record.nextMaintenanceDate,
      characteristics: record.characteristics,
      location,
      lastPosition: record.lastPosition
        ? {
            latitude: record.lastPosition.latitude,
            longitude: record.lastPosition.longitude,
            recordedAt: record.lastPosition.recordedAt.toISOString(),
          }
        : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
