import { BadRequestException, type MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { DataSource } from 'typeorm';
import type { OperationalEvent } from '@fogo/contracts';
import { MonitoringWriteService } from './monitoring-write.service.js';
import { OperationalEventEntity } from './operational-event.entity.js';
import { MonitoringEventsService } from './monitoring-events.service.js';

const occurredAt = '2026-10-24T12:00:00.000Z';

function liveEvent(id: string): OperationalEvent {
  return {
    id,
    type: 'equipment.updated',
    resourceType: 'equipment',
    resourceId: 'equipment-1',
    source: 'api',
    payload: { status: 'operational' },
    occurredAt,
  };
}

function storedEvent(id: string, eventType: OperationalEventEntity['eventType'] = 'equipment.updated'): OperationalEventEntity {
  return {
    id,
    eventType,
    resourceType: 'equipment',
    resourceId: 'equipment-1',
    source: 'api',
    payload: { status: 'operational' },
    createdAt: new Date(occurredAt),
  } as OperationalEventEntity;
}

function makeService(getMany: () => Promise<OperationalEventEntity[]> = () => Promise.resolve([])) {
  const events$ = new Subject<OperationalEvent>();
  const query = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getMany: vi.fn(getMany),
  };
  const dataSource = {
    getRepository: vi.fn().mockReturnValue({ createQueryBuilder: vi.fn().mockReturnValue(query) }),
  };
  const service = new MonitoringEventsService(
    dataSource as unknown as DataSource,
    { events$: events$.asObservable() } as MonitoringWriteService,
  );
  return { service, events$, dataSource, query };
}

describe('MonitoringEventsService', () => {
  it.each(['abc', '12x', '-4'])('rejects a non-numeric event cursor: %s', (cursor) => {
    const { service } = makeService();

    expect(() => service.stream(cursor)).toThrow(BadRequestException);
  });

  it('streams new live events and ignores older or duplicate ids', () => {
    const { service, events$ } = makeService();
    const received: MessageEvent[] = [];
    const subscription = service.stream().subscribe((event) => received.push(event));

    events$.next(liveEvent('2'));
    events$.next(liveEvent('1'));
    events$.next(liveEvent('2'));
    subscription.unsubscribe();
    events$.next(liveEvent('3'));

    expect(received.map(({ id }) => id)).toEqual(['2']);
    expect(received[0]).toMatchObject({ type: 'equipment.updated', data: { id: '2', resourceId: 'equipment-1' } });
  });

  it('trims a cursor and queries persisted events after it in ascending order', async () => {
    const { service, query } = makeService();
    const subscription = service.stream(' 4 ').subscribe();
    await new Promise((resolve) => setTimeout(resolve, 0));
    subscription.unsubscribe();

    expect(query.where).toHaveBeenCalledWith('event.id > :cursor', { cursor: '4' });
    expect(query.andWhere).toHaveBeenCalledWith("event.eventType <> 'equipment.observed'");
    expect(query.orderBy).toHaveBeenCalledWith('event.id', 'ASC');
  });

  it('keeps daily status observations out of the user-facing event replay', async () => {
    const { service } = makeService(() => Promise.resolve([
      storedEvent('5', 'equipment.observed'),
      storedEvent('6'),
    ]));
    const received: MessageEvent[] = [];
    const subscription = service.stream('4').subscribe((event) => received.push(event));
    await new Promise((resolve) => setTimeout(resolve, 0));
    subscription.unsubscribe();

    expect(received.map(({ id }) => id)).toEqual(['6']);
  });

  it('replays history before live events received during the database query', async () => {
    let completeHistory: ((events: OperationalEventEntity[]) => void) | undefined;
    const { service, events$ } = makeService(() => new Promise((resolve) => { completeHistory = resolve; }));
    const received: MessageEvent[] = [];
    const subscription = service.stream('4').subscribe((event) => received.push(event));

    events$.next(liveEvent('7'));
    completeHistory?.([storedEvent('3'), storedEvent('5'), storedEvent('6')]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(received.map(({ id }) => id)).toEqual(['5', '6', '7']);
    subscription.unsubscribe();
  });

  it('does not emit a delayed replay after the subscriber has unsubscribed', async () => {
    let completeHistory: ((events: OperationalEventEntity[]) => void) | undefined;
    const { service } = makeService(() => new Promise((resolve) => { completeHistory = resolve; }));
    const next = vi.fn();
    const subscription = service.stream('1').subscribe({ next });
    subscription.unsubscribe();
    completeHistory?.([storedEvent('2')]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(next).not.toHaveBeenCalled();
  });

  it('returns a safe stream error when persisted history cannot be read', async () => {
    const { service } = makeService(() => Promise.reject(new Error('private database details')));
    const onError = vi.fn();
    service.stream('1').subscribe({ error: onError });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onError).toHaveBeenCalledWith(new Error('Não foi possível recuperar o histórico recente de eventos.'));
    expect(onError.mock.calls[0]?.[0].message).not.toContain('private database details');
  });

  it('sends heartbeat events and clears the timer on unsubscribe', () => {
    vi.useFakeTimers();
    const { service } = makeService();
    const received: MessageEvent[] = [];
    const subscription = service.stream().subscribe((event) => received.push(event));

    try {
      vi.advanceTimersByTime(25_000);
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ type: 'heartbeat' });
      subscription.unsubscribe();
      vi.advanceTimersByTime(25_000);
      expect(received).toHaveLength(1);
    } finally {
      subscription.unsubscribe();
      vi.useRealTimers();
    }
  });
});
