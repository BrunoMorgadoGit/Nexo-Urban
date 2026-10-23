import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { IntelligenceQueryDto } from './dto/intelligence-query.dto.js';
import { IntelligenceService } from './intelligence.service.js';

@Controller('intelligence')
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Get('overview') overview(@Query() query: IntelligenceQueryDto) { return this.intelligence.overview(query.sourceScope); }
  @Get('regions') regions(@Query() query: IntelligenceQueryDto) { return this.intelligence.regions(query.sourceScope); }
  @Get('regions/:id') region(@Param('id', new ParseUUIDPipe()) id: string, @Query() query: IntelligenceQueryDto) {
    return this.intelligence.region(id, query.sourceScope);
  }
  @Get('maintenance-priorities') maintenancePriorities(@Query() query: IntelligenceQueryDto) {
    return this.intelligence.maintenancePriorities(query.sourceScope);
  }
  @Get('trends') trends(@Query() query: IntelligenceQueryDto) { return this.intelligence.trends(query.sourceScope); }
  @Get('validation') validation(@Query() query: IntelligenceQueryDto) { return this.intelligence.validation(query.sourceScope); }
}
