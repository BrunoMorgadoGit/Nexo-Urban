import { Controller, Get } from '@nestjs/common';
import { EquipmentTypesService } from './equipment-types.service.js';

@Controller('equipment-types')
export class EquipmentTypesController {
  constructor(private readonly equipmentTypesService: EquipmentTypesService) {}

  @Get()
  list() {
    return this.equipmentTypesService.list();
  }
}
