export function isDemoScenarioEnabled(environment: Record<string, string | undefined>): boolean {
  return environment.NODE_ENV === 'development' && environment.DEMO_SCENARIO_ENABLED === 'true';
}
