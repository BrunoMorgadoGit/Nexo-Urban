import { Controller, Get } from '@nestjs/common';
import { RegionsService } from './regions.service.js';

@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get()
  list() {
    return this.regionsService.list();
  }
}
