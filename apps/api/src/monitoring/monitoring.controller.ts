import { Controller, Get, Headers, Param, ParseUUIDPipe, Post, Body, Query, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import { CreateAlertNoteDto } from './dto/create-alert-note.dto.js';
import { ListMonitoringAlertsDto } from './dto/list-monitoring-alerts.dto.js';
import { MonitoringMapQueryDto } from './dto/monitoring-map-query.dto.js';
import { MonitoringAlertsService } from './monitoring-alerts.service.js';
import { MonitoringEventsService } from './monitoring-events.service.js';
import { MonitoringReadService } from './monitoring-read.service.js';

@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly read: MonitoringReadService,
    private readonly alerts: MonitoringAlertsService,
    private readonly events: MonitoringEventsService,
  ) {}

  @Get('overview') overview() { return this.read.overview(); }
  @Get('map') map(@Query() query: MonitoringMapQueryDto) { return this.read.map(query); }
  @Get('regions') regions() { return this.read.regions(); }
  @Get('maintenance-alerts') maintenanceAlerts() { return this.read.maintenanceAlerts(); }
  @Get('alerts') listAlerts(@Query() query: ListMonitoringAlertsDto) { return this.alerts.list(query); }
  @Get('alerts/:id') getAlert(@Param('id', new ParseUUIDPipe()) id: string) { return this.alerts.get(id); }

  @Post('alerts/:id/acknowledge')
  acknowledge(@Param('id', new ParseUUIDPipe()) id: string) { return this.alerts.acknowledge(id); }

  @Post('alerts/:id/notes')
  addNote(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: CreateAlertNoteDto) {
    return this.alerts.addNote(id, input.note);
  }

  @Post('alerts/:id/resolve')
  resolve(@Param('id', new ParseUUIDPipe()) id: string) { return this.alerts.resolve(id); }

  @Sse('events/stream')
  stream(
    @Headers('last-event-id') lastEventId: string | undefined,
    @Query('since') since: string | undefined,
  ): Observable<MessageEvent> {
    return this.events.stream(lastEventId ?? since);
  }
}
