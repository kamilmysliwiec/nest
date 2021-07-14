import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { isNil } from '@nestjs/common/utils/shared.utils';
import {
  connectable,
  defer,
  fromEvent,
  merge,
  Observable,
  Observer,
  Subject,
  throwError as _throw,
} from 'rxjs';
import { map, mergeMap, take } from 'rxjs/operators';
import { CONNECT_EVENT, ERROR_EVENT } from '../constants';
import { IncomingResponseDeserializer } from '../deserializers/incoming-response.deserializer';
import { InvalidMessageException } from '../errors/invalid-message.exception';
import {
  ClientOptions,
  KafkaOptions,
  MqttOptions,
  MsPattern,
  NatsOptions,
  PacketId,
  ReadPacket,
  RedisOptions,
  RmqOptions,
  TcpClientOptions,
  TcpTlsClientOptions,
  WritePacket,
} from '../interfaces';
import { ProducerDeserializer } from '../interfaces/deserializer.interface';
import { ProducerSerializer } from '../interfaces/serializer.interface';
import { IdentitySerializer } from '../serializers/identity.serializer';
import { transformPatternToRoute } from '../utils';

export abstract class ClientProxy {
  public abstract connect(): Promise<any>;
  public abstract close(): any;

  protected routingMap = new Map<string, Function>();
  protected serializer: ProducerSerializer;
  protected deserializer: ProducerDeserializer;

  public send<TResult = any, TInput = any>(
    pattern: any,
    data: TInput,
  ): Observable<TResult> {
    if (isNil(pattern) || isNil(data)) {
      return _throw(new InvalidMessageException());
    }
    return defer(async () => this.connect()).pipe(
      mergeMap(
        () =>
          new Observable((observer: Observer<TResult>) => {
            const callback = this.createObserver(observer);
            return this.publish({ pattern, data }, callback);
          }),
      ),
    );
  }

  public emit<TResult = any, TInput = any>(
    pattern: any,
    data: TInput,
  ): Observable<TResult> {
    if (isNil(pattern) || isNil(data)) {
      return _throw(() => new InvalidMessageException());
    }
    const source = defer(async () => this.connect()).pipe(
      mergeMap(() => this.dispatchEvent({ pattern, data })),
    );
    const connectableSource = connectable(source, {
      connector: () => new Subject(),
      resetOnDisconnect: false,
    });
    connectableSource.connect();
    return connectableSource;
  }

  protected abstract publish(
    packet: ReadPacket,
    callback: (packet: WritePacket) => void,
  ): () => void;

  protected abstract dispatchEvent<T = any>(packet: ReadPacket): Promise<T>;

  protected createObserver<T>(
    observer: Observer<T>,
  ): (packet: WritePacket) => void {
    return ({ err, response, isDisposed }: WritePacket) => {
      if (err) {
        return observer.error(this.serializeError(err));
      } else if (response !== undefined && isDisposed) {
        observer.next(this.serializeResponse(response));
        return observer.complete();
      } else if (isDisposed) {
        return observer.complete();
      }
      observer.next(this.serializeResponse(response));
    };
  }

  protected serializeError(err: any): any {
    return err;
  }

  protected serializeResponse(response: any): any {
    return response;
  }

  protected assignPacketId(packet: ReadPacket): ReadPacket & PacketId {
    const id = randomStringGenerator();
    return Object.assign(packet, { id });
  }

  protected connect$(
    instance: any,
    errorEvent = ERROR_EVENT,
    connectEvent = CONNECT_EVENT,
  ): Observable<any> {
    const error$ = fromEvent(instance, errorEvent).pipe(
      map((err: any) => {
        throw err;
      }),
    );
    const connect$ = fromEvent(instance, connectEvent);
    return merge(error$, connect$).pipe(take(1));
  }

  protected getOptionsProp<
    T extends ClientOptions['options'],
    K extends keyof T,
  >(obj: T, prop: K, defaultValue: T[K] = undefined) {
    return (obj && obj[prop]) || defaultValue;
  }

  protected normalizePattern(pattern: MsPattern): string {
    return transformPatternToRoute(pattern);
  }

  protected initializeSerializer(options: ClientOptions['options']) {
    this.serializer =
      (options &&
        (
          options as
            | RedisOptions['options']
            | NatsOptions['options']
            | MqttOptions['options']
            | TcpClientOptions['options']
            | TcpTlsClientOptions['options']
            | RmqOptions['options']
            | KafkaOptions['options']
        ).serializer) ||
      new IdentitySerializer();
  }

  protected initializeDeserializer(options: ClientOptions['options']) {
    this.deserializer =
      (options &&
        (
          options as
            | RedisOptions['options']
            | NatsOptions['options']
            | MqttOptions['options']
            | TcpClientOptions['options']
            | TcpTlsClientOptions['options']
            | RmqOptions['options']
            | KafkaOptions['options']
        ).deserializer) ||
      new IncomingResponseDeserializer();
  }
}
