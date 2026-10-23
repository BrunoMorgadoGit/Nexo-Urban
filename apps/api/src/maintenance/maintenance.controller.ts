import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { ListMaintenanceDto } from './dto/list-maintenance.dto.js';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto.js';
import { MaintenanceService } from './maintenance.service.js';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post()
  create(@Body() input: CreateMaintenanceDto) {
    return this.maintenanceService.create(input);
  }

  @Get()
  list(@Query() query: ListMaintenanceDto) {
    return this.maintenanceService.list(query);
  }

  @Get('overview')
  overview() {
    return this.maintenanceService.overview();
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateMaintenanceStatusDto,
  ) {
    return this.maintenanceService.updateStatus(id, input.status);
  }
}
