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
    service.acquire({ onDestroy: (callback: () => void) => { destroy = callback; } } as DestroyRef);
    const source = FakeEventSource.instances[0];

    expect(source.url).toBe('http://127.0.0.1:3000/api/v1/monitoring/events/stream');
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
});
