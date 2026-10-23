import { DestroyRef, Injectable, signal } from '@angular/core';
import type { OperationalEvent, OperationalEventType } from '@fogo/contracts';

export type RealtimeConnectionState = 'connecting' | 'connected' | 'disconnected';

@Injectable({ providedIn: 'root' })
export class MonitoringRealtimeService {
  readonly state = signal<RealtimeConnectionState>('connecting');
  readonly refreshVersion = signal(0);
  private source: EventSource | null = null;
  private references = 0;
  private lastEventId = '';
  private readonly seenIds = new Set<string>();
  private readonly eventTypes: OperationalEventType[] = [
    'equipment.updated', 'agent.updated', 'maintenance.created', 'maintenance.updated',
    'alert.created', 'alert.updated', 'alert.resolved', 'demo.scenario.changed',
  ];

  acquire(destroyRef: DestroyRef): void {
    this.references += 1;
    if (!this.source) this.open();
    destroyRef.onDestroy(() => {
      this.references = Math.max(0, this.references - 1);
      if (this.references === 0) this.close();
    });
  }

  private open(): void {
    if (typeof EventSource === 'undefined') {
      this.state.set('disconnected');
      return;
    }
    this.state.set('connecting');
    const params = this.lastEventId ? `?since=${encodeURIComponent(this.lastEventId)}` : '';
    const source = new EventSource(`http://127.0.0.1:3000/api/v1/monitoring/events/stream${params}`);
    this.source = source;
    source.onopen = () => {
      this.state.set('connected');
      this.refreshVersion.update((version) => version + 1);
    };
    source.onerror = () => this.state.set('disconnected');
    for (const type of this.eventTypes) {
      source.addEventListener(type, (message: Event) => this.receive(message as MessageEvent<string>));
    }
  }

  private receive(message: MessageEvent<string>): void {
    if (!message.data) return;
    let event: OperationalEvent;
    try {
      event = JSON.parse(message.data) as OperationalEvent;
    } catch {
      return;
    }
    if (!event.id || this.seenIds.has(event.id)) return;
    this.seenIds.add(event.id);
    this.lastEventId = event.id;
    if (this.seenIds.size > 1000) this.seenIds.clear();
    this.refreshVersion.update((version) => version + 1);
  }

  private close(): void {
    this.source?.close();
    this.source = null;
    this.state.set('disconnected');
  }
}
