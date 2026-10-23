import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CreateEquipmentDto } from './dto/create-equipment.dto.js';
import { ListEquipmentDto } from './dto/list-equipment.dto.js';
import { EquipmentService } from './equipment.service.js';

@Controller('equipments')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Post()
  create(@Body() input: CreateEquipmentDto) {
    return this.equipmentService.create(input);
  }

  @Get()
  list(@Query() query: ListEquipmentDto) {
    return this.equipmentService.list(query);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.equipmentService.get(id);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateEquipmentDto,
  ) {
    return this.equipmentService.update(id, input);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.equipmentService.deactivate(id);
  }

  @Delete(':id')
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.equipmentService.deactivate(id);
  }
}
