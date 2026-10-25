import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { CreateAgentDto } from './dto/create-agent.dto.js';
import { ListAgentsDto } from './dto/list-agents.dto.js';
import { AgentsService } from './agents.service.js';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  create(@Body() input: CreateAgentDto) {
    return this.agentsService.create(input);
  }

  @Get()
  list(@Query() query: ListAgentsDto) {
    return this.agentsService.list(query);
  }

  @Get('operational-bases')
  listOperationalBases() {
    return this.agentsService.listOperationalBases();
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.agentsService.get(id);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateAgentDto,
  ) {
    return this.agentsService.update(id, input);
  }

  @Delete(':id')
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.agentsService.delete(id);
  }
}
