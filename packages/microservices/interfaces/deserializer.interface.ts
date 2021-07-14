import {
  IncomingEvent,
  IncomingRequest,
  IncomingResponse,
} from './packet.interface';

export interface Deserializer<TInput = any, TOutput = any> {
  deserialize(
    value: TInput,
    options?: Record<string, any>,
  ): TOutput | Promise<TOutput>;
}

export type ProducerDeserializer = Deserializer<any, IncomingResponse>;
export type ConsumerDeserializer = Deserializer<
  any,
  IncomingRequest | IncomingEvent
>;
