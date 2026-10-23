import { Controller, Get, Post } from '@nestjs/common';
import { DemoScenarioService } from './demo-scenario.service.js';

@Controller('monitoring/demo/scenario')
export class DemoScenarioController {
  constructor(private readonly scenarios: DemoScenarioService) {}

  @Get()
  get() { return this.scenarios.get(); }

  @Post('outage')
  outage() { return this.scenarios.outage(); }

  @Post('reset')
  reset() { return this.scenarios.reset(); }
}
