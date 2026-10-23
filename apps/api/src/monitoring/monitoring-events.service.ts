import { BadRequestException, Injectable, MessageEvent } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Observable } from 'rxjs';
import { OperationalEventEntity } from './operational-event.entity.js';
import { MonitoringWriteService } from './monitoring-write.service.js';

@Injectable()
export class MonitoringEventsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly monitoringWrite: MonitoringWriteService,
  ) {}

  stream(lastEventId?: string | null): Observable<MessageEvent> {
    const cursor = lastEventId?.trim() || null;
    if (cursor && !/^\d+$/.test(cursor)) {
      throw new BadRequestException('Identificador de evento inválido.');
    }

    return new Observable<MessageEvent>((subscriber) => {
      let isActive = true;
      let replaying = Boolean(cursor);
      let lastSent = cursor ? BigInt(cursor) : 0n;
      const queued: OperationalEventEntity[] = [];

      const emit = (event: OperationalEventEntity): void => {
        const eventId = BigInt(event.id);
        if (eventId <= lastSent || subscriber.closed) return;
        lastSent = eventId;
        subscriber.next({
          id: event.id,
          type: event.eventType,
          data: {
            id: event.id,
            type: event.eventType,
            source: event.source,
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            payload: event.payload,
            occurredAt: event.createdAt.toISOString(),
          },
        });
      };

      const liveSubscription = this.monitoringWrite.events$.subscribe((event) => {
        const row = {
          id: event.id,
          eventType: event.type,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          payload: event.payload,
          source: event.source,
          createdAt: new Date(event.occurredAt),
        } satisfies OperationalEventEntity;
        if (replaying) queued.push(row);
        else emit(row);
      });

      const heartbeat = setInterval(() => {
        if (isActive && !subscriber.closed) {
          subscriber.next({ type: 'heartbeat', data: { timestamp: new Date().toISOString() } });
        }
      }, 25_000);

      if (cursor) {
        void this.dataSource.getRepository(OperationalEventEntity)
          .createQueryBuilder('event')
          .where('event.id > :cursor', { cursor })
          .orderBy('event.id', 'ASC')
          .getMany()
          .then((events) => {
            if (!isActive) return;
            events.forEach(emit);
            replaying = false;
            queued.sort((left, right) => (BigInt(left.id) < BigInt(right.id) ? -1 : 1));
            queued.forEach(emit);
          })
          .catch(() => subscriber.error(new Error('Não foi possível recuperar o histórico recente de eventos.')));
      }

      return () => {
        isActive = false;
        liveSubscription.unsubscribe();
        clearInterval(heartbeat);
      };
    });
  }
}
