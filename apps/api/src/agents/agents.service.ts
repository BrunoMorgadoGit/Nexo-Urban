import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AgentContract, Page } from '@fogo/contracts';
import { DataSource, Repository } from 'typeorm';
import { AgentPositionEntity } from '../locations/agent-position.entity.js';
import { OrganizationEntity } from '../organizations/organization.entity.js';
import { AgentEntity } from './agent.entity.js';
import { CreateAgentDto } from './dto/create-agent.dto.js';
import { ListAgentsDto } from './dto/list-agents.dto.js';

@Injectable()
export class AgentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AgentEntity)
    private readonly agents: Repository<AgentEntity>,
    @InjectRepository(AgentPositionEntity)
    private readonly positions: Repository<AgentPositionEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizations: Repository<OrganizationEntity>,
  ) {}

  async create(input: CreateAgentDto): Promise<AgentContract> {
    const identifier = input.identifier.trim().toUpperCase();
    const organization = await this.organizations.findOne({
      where: { id: input.organizationId, isActive: true },
    });
    if (!organization) throw new BadRequestException('Órgão responsável inválido ou inativo.');
    if (await this.agents.exists({ where: { identifier } })) {
      throw new ConflictException('Identificação funcional já cadastrada.');
    }

    const id = await this.dataSource.transaction(async (manager) => {
      const agent = await manager.getRepository(AgentEntity).save(
        manager.getRepository(AgentEntity).create({
          name: input.name.trim(),
          identifier,
          category: input.category,
          organizationId: organization.id,
          organization,
          availability: input.availability,
        }),
      );
      if (input.position) {
        await manager.getRepository(AgentPositionEntity).save({
          agentId: agent.id,
          agent,
          latitude: input.position.latitude,
          longitude: input.position.longitude,
          recordedAt: new Date(input.position.recordedAt),
        });
      }
      return agent.id;
    });
    return this.get(id);
  }

  async list(query: ListAgentsDto): Promise<Page<AgentContract>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const builder = this.agents
      .createQueryBuilder('agent')
      .leftJoinAndSelect('agent.organization', 'organization')
      .leftJoinAndSelect('agent.position', 'position');
    if (query.search) {
      builder.andWhere(
        '(agent.name ILIKE :search OR agent.identifier ILIKE :search OR organization.name ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }
    if (query.category) builder.andWhere('agent.category = :category', { category: query.category });
    if (query.availability) {
      builder.andWhere('agent.availability = :availability', { availability: query.availability });
    }
    if (query.organizationId) {
      builder.andWhere('agent.organizationId = :organizationId', { organizationId: query.organizationId });
    }

    const [records, total] = await builder
      .orderBy('agent.name', 'ASC')
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

  async get(id: string): Promise<AgentContract> {
    const record = await this.agents
      .createQueryBuilder('agent')
      .leftJoinAndSelect('agent.organization', 'organization')
      .leftJoinAndSelect('agent.position', 'position')
      .where('agent.id = :id', { id })
      .getOne();
    if (!record) throw new NotFoundException('Agente não encontrado.');
    return this.toContract(record);
  }

  async update(id: string, input: CreateAgentDto): Promise<AgentContract> {
    const current = await this.agents.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Agente não encontrado.');
    const organization = await this.organizations.findOne({
      where: { id: input.organizationId, isActive: true },
    });
    if (!organization) throw new BadRequestException('Órgão responsável inválido ou inativo.');
    const normalizedIdentifier = input.identifier.trim().toUpperCase();
    const duplicate = await this.agents
      .createQueryBuilder('agent')
      .where('agent.identifier = :identifier', { identifier: normalizedIdentifier })
      .andWhere('agent.id <> :id', { id })
      .getExists();
    if (duplicate) throw new ConflictException('Identificação funcional já cadastrada.');

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(AgentEntity).save({
        id: current.id,
        name: input.name.trim(),
        identifier: normalizedIdentifier,
        category: input.category,
        organizationId: organization.id,
        availability: input.availability,
      });
      const positionRepository = manager.getRepository(AgentPositionEntity);
      const position = await positionRepository.findOne({ where: { agentId: id } });
      if (input.position) {
        await positionRepository.save({
          id: position?.id,
          agentId: id,
          latitude: input.position.latitude,
          longitude: input.position.longitude,
          recordedAt: new Date(input.position.recordedAt),
        });
      } else if (position) {
        await positionRepository.remove(position);
      }
    });
    return this.get(id);
  }

  private toContract(record: AgentEntity): AgentContract {
    if (!record.organization) throw new Error('Agent organization relation is incomplete');
    return {
      id: record.id,
      name: record.name,
      identifier: record.identifier,
      category: record.category,
      organizationId: record.organizationId,
      organizationName: record.organization.name,
      availability: record.availability,
      position: record.position
        ? {
            latitude: record.position.latitude,
            longitude: record.position.longitude,
            recordedAt: record.position.recordedAt.toISOString(),
          }
        : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
