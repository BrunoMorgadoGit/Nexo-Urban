import type { DemoScenario, DemoTimelineEntry, MonitoringAlert } from '@fogo/contracts';
import { demoGuideStepState } from './demo-guide-progress';

const scenario: DemoScenario = {
  mode: 'DEMONSTRATION',
  code: 'radar-outage',
  label: 'Indisponibilidade controlada de radar',
  equipmentId: 'd912675e-2fe9-469a-986b-451859a30bac',
  serialNumber: 'DEMO-RAD-001',
  status: 'operational',
  initialStatus: 'operational',
  active: false,
};

const incident: MonitoringAlert = {
  id: '3f175c06-783e-4ca1-9f79-fcf072c48de8',
  code: 'equipment_malfunctioning',
  severity: 'critical',
  status: 'open',
  canResolve: false,
  title: 'Equipamento com mau funcionamento',
  description: 'O recurso requer avaliação operacional.',
  resourceType: 'equipment',
  resourceId: scenario.equipmentId,
  resourceLabel: scenario.serialNumber,
  organizationName: 'DSIN',
  regionName: 'Ouro Verde',
  createdAt: '2026-10-24T12:00:00.000Z',
  updatedAt: '2026-10-24T12:00:00.000Z',
  acknowledgedAt: null,
  resolvedAt: null,
  actions: [],
  detailPath: `/equipments/${scenario.equipmentId}`,
};

const event = (status: string, id: string): DemoTimelineEntry => ({
  id,
  occurredAt: '2026-10-24T12:00:00.000Z',
  serialNumber: scenario.serialNumber,
  eventType: 'demo.scenario.changed',
  source: 'demo',
  status,
  description: status === 'malfunctioning' ? 'Falha aplicada.' : 'Estado operacional restaurado.',
  equipmentId: scenario.equipmentId,
});

describe('demoGuideStepState', () => {
  it('shows the next action from backend state without marking unobserved steps complete', () => {
    expect(demoGuideStepState(1, scenario, null, [])).toBe('ready');
    expect(demoGuideStepState(2, scenario, null, [])).toBe('current');
    expect(demoGuideStepState(3, scenario, null, [])).toBe('waiting');
    expect(demoGuideStepState(4, scenario, null, [])).toBe('waiting');
    expect(demoGuideStepState(5, scenario, null, [])).toBe('waiting');
  });

  it('marks the incident and operator response from the alert returned by the API', () => {
    const activeScenario = { ...scenario, active: true, status: 'malfunctioning' as const };
    expect(demoGuideStepState(2, activeScenario, incident, [])).toBe('completed');
    expect(demoGuideStepState(3, activeScenario, incident, [])).toBe('completed');
    expect(demoGuideStepState(4, activeScenario, incident, [])).toBe('current');
    expect(demoGuideStepState(5, activeScenario, incident, [])).toBe('waiting');

    const acknowledged = {
      ...incident,
      status: 'acknowledged' as const,
      actions: [{ id: 'action-1', type: 'acknowledged' as const, note: null, actor: 'Operador local', createdAt: incident.createdAt }],
    };
    expect(demoGuideStepState(4, activeScenario, acknowledged, [])).toBe('completed');
    expect(demoGuideStepState(5, activeScenario, acknowledged, [])).toBe('current');
    expect(demoGuideStepState(4, scenario, { ...acknowledged, status: 'resolved' }, [])).toBe('completed');
  });

  it('marks restoration complete only when the persisted demo timeline contains an outage followed by restoration', () => {
    expect(demoGuideStepState(5, scenario, incident, [event('malfunctioning', 'outage')])).toBe('waiting');
    expect(demoGuideStepState(5, scenario, incident, [event('malfunctioning', 'outage'), event('operational', 'restore')])).toBe('completed');
  });
});
