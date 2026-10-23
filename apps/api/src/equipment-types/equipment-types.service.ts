import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { EquipmentTypeContract } from '@fogo/contracts';
import { EquipmentTypeEntity } from './equipment-type.entity.js';

@Injectable()
export class EquipmentTypesService {
  constructor(
    @InjectRepository(EquipmentTypeEntity)
    private readonly equipmentTypes: Repository<EquipmentTypeEntity>,
  ) {}

  async list(): Promise<EquipmentTypeContract[]> {
    const records = await this.equipmentTypes.find({ order: { label: 'ASC' } });
    return records.map(({ code, label, mobility, characteristics }) => ({
      code,
      label,
      mobility,
      characteristics,
    }));
  }
}
