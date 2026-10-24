import type { DemoScenario, DemoTimelineEntry, MonitoringAlert } from '@fogo/contracts';

export type DemoGuideStep = 1 | 2 | 3 | 4 | 5;
export type DemoGuideStepState = 'ready' | 'current' | 'completed' | 'waiting';

export function demoGuideStepState(
  step: DemoGuideStep,
  scenario: DemoScenario,
  alert: MonitoringAlert | null,
  timeline: DemoTimelineEntry[],
): DemoGuideStepState {
  if (step === 1) return 'ready';

  const activeIncident = scenario.active && alert !== null && alert.status !== 'resolved';
  const operatorResponded = alert?.actions.some((action) => action.type === 'acknowledged' || action.type === 'note') ?? false;
  const scenarioChanges = timeline.filter((event) => event.source === 'demo' && event.eventType === 'demo.scenario.changed');
  const lastChanges = scenarioChanges.slice(-2);
  const restorationObserved = !scenario.active
    && lastChanges.length === 2
    && lastChanges[0].status === 'malfunctioning'
    && lastChanges[1].status === 'operational';

  switch (step) {
    case 2:
      return scenario.active ? 'completed' : 'current';
    case 3:
      return alert ? 'completed' : scenario.active ? 'current' : 'waiting';
    case 4:
      if (operatorResponded) return 'completed';
      return activeIncident ? 'current' : 'waiting';
    case 5:
      if (scenario.active) return activeIncident && operatorResponded ? 'current' : 'waiting';
      return restorationObserved ? 'completed' : 'waiting';
  }
}
