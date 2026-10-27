import type { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MonitoringRealtimeService } from './monitoring-realtime.service';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, Array<(event: Event) => void>>();

  constructor(readonly url: string) { FakeEventSource.instances.push(this); }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const current = this.listeners.get(type) ?? [];
    current.push(typeof listener === 'function' ? listener : (event) => listener.handleEvent(event));
    this.listeners.set(type, current);
  }

  deliver(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  close(): void { this.closed = true; }

  emit(type: string, id: string): void {
    const event = new MessageEvent(type, {
      data: JSON.stringify({ id, type, source: 'api', resourceType: 'equipment', resourceId: 'equipment-1', payload: {}, occurredAt: new Date().toISOString() }),
      lastEventId: id,
    });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe('MonitoringRealtimeService', () => {
  let previousEventSource: typeof EventSource | undefined;

  beforeEach(() => {
    FakeEventSource.instances = [];
    previousEventSource = globalThis.EventSource;
    Object.defineProperty(globalThis, 'EventSource', { configurable: true, value: FakeEventSource });
    TestBed.configureTestingModule({ providers: [MonitoringRealtimeService] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    if (previousEventSource) Object.defineProperty(globalThis, 'EventSource', { configurable: true, value: previousEventSource });
    else Reflect.deleteProperty(globalThis, 'EventSource');
  });

  it('recovers a fresh snapshot after connect and reconnect and ignores duplicate event identifiers', () => {
    const service = TestBed.inject(MonitoringRealtimeService);
    let destroy: (() => void) | undefined;
    service.acquire({ destroyed: false, onDestroy: (callback: () => void) => { destroy = callback; return () => undefined; } } as DestroyRef);
    const source = FakeEventSource.instances[0];

    expect(source.url).toBe('/api/v1/monitoring/events/stream');
    source.onopen?.();
    expect(service.state()).toBe('connected');
    expect(service.refreshVersion()).toBe(1);

    source.emit('equipment.updated', '20');
    source.emit('equipment.updated', '20');
    expect(service.refreshVersion()).toBe(2);

    source.onerror?.();
    expect(service.state()).toBe('disconnected');
    source.onopen?.();
    expect(service.refreshVersion()).toBe(3);
    expect(service.state()).toBe('connected');

    destroy?.();
    expect(source.closed).toBe(true);
    expect(service.state()).toBe('disconnected');
  });

  it('keeps one shared stream until every consumer releases it', () => {
    const service = TestBed.inject(MonitoringRealtimeService);
    const destroyCallbacks: Array<() => void> = [];
    const destroyRef = {
      destroyed: false,
      onDestroy: (callback: () => void) => { destroyCallbacks.push(callback); return () => undefined; },
    } as DestroyRef;
    service.acquire(destroyRef);
    service.acquire(destroyRef);

    expect(FakeEventSource.instances).toHaveLength(1);
    destroyCallbacks[0]();
    expect(FakeEventSource.instances[0].closed).toBe(false);
    destroyCallbacks[1]();
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it('refreshes operational snapshots after an agent is deleted', () => {
    const service = TestBed.inject(MonitoringRealtimeService);
    service.acquire({ destroyed: false, onDestroy: () => () => undefined } as DestroyRef);
    const source = FakeEventSource.instances[0];

    source.emit('agent.deleted', 'agent-delete-1');

    expect(service.refreshVersion()).toBe(1);
  });

  it('ignores empty and malformed events without refreshing snapshots', () => {
    const service = TestBed.inject(MonitoringRealtimeService);
    service.acquire({ destroyed: false, onDestroy: () => () => undefined } as DestroyRef);
    const source = FakeEventSource.instances[0];
    source.deliver('equipment.updated', new MessageEvent('equipment.updated', { data: '' }));
    source.deliver('equipment.updated', new MessageEvent('equipment.updated', { data: '{invalid' }));
    expect(service.refreshVersion()).toBe(0);
  });

  it('reports a disconnected state when the browser does not expose EventSource', () => {
    Object.defineProperty(globalThis, 'EventSource', { configurable: true, value: undefined });
    const service = TestBed.inject(MonitoringRealtimeService);

    service.acquire({ destroyed: false, onDestroy: () => () => undefined } as DestroyRef);

    expect(service.state()).toBe('disconnected');
  });
});
