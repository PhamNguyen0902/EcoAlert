export interface IEventMessage<T> {
  eventId: string;
  eventType: string;
  timestamp: string;
  source: string;
  correlationId: string;
  data: T;
}
