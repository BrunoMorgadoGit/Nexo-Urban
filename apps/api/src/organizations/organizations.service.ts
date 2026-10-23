import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { OrganizationContract } from '@fogo/contracts';
import { OrganizationEntity } from './organization.entity.js';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizations: Repository<OrganizationEntity>,
  ) {}

  async list(): Promise<OrganizationContract[]> {
    const records = await this.organizations.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
    return records.map(({ id, code, name }) => ({ id, code, name }));
  }
}
