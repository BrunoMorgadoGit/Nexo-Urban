import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RegionContract } from '@fogo/contracts';
import { RegionEntity } from './region.entity.js';

@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(RegionEntity)
    private readonly regions: Repository<RegionEntity>,
  ) {}

  async list(): Promise<RegionContract[]> {
    const records = await this.regions.find({ order: { zone: 'ASC', name: 'ASC' } });
    return records.map(({ id, code, name, zone, city, state }) => ({
      id,
      code,
      name,
      zone,
      city,
      state,
    }));
  }
}
