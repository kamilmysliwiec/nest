import { Logger } from '@nestjs/common/services/logger.service';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { EventEmitter } from 'events';
import { EmptyError, fromEvent, lastValueFrom, merge, Observable } from 'rxjs';
import { first, map, share, switchMap } from 'rxjs/operators';
import {
  DISCONNECTED_RMQ_MESSAGE,
  DISCONNECT_EVENT,
  ERROR_EVENT,
  RQM_DEFAULT_IS_GLOBAL_PREFETCH_COUNT,
  RQM_DEFAULT_NOACK,
  RQM_DEFAULT_PERSISTENT,
  RQM_DEFAULT_PREFETCH_COUNT,
  RQM_DEFAULT_QUEUE,
  RQM_DEFAULT_QUEUE_OPTIONS,
  RQM_DEFAULT_URL,
} from '../constants';
import { RmqUrl } from '../external/rmq-url.interface';
import { ReadPacket, RmqOptions, WritePacket } from '../interfaces';
import { ClientProxy } from './client-proxy';

let rqmPackage: any = {};

const REPLY_QUEUE = 'amq.rabbitmq.reply-to';

export class ClientRMQ extends ClientProxy {
  protected readonly logger = new Logger(ClientProxy.name);
  protected connection: Promise<any>;
  protected client: any = null;
  protected channel: any = null;
  protected urls: string[] | RmqUrl[];
  protected queue: string;
  protected queueOptions: any;
  protected responseEmitter: EventEmitter;
  protected replyQueue: string;
  protected persistent: boolean;

  constructor(protected readonly options: RmqOptions['options']) {
    super();
    this.urls = this.getOptionsProp(this.options, 'urls') || [RQM_DEFAULT_URL];
    this.queue =
      this.getOptionsProp(this.options, 'queue') || RQM_DEFAULT_QUEUE;
    this.queueOptions =
      this.getOptionsProp(this.options, 'queueOptions') ||
      RQM_DEFAULT_QUEUE_OPTIONS;
    this.replyQueue =
      this.getOptionsProp(this.options, 'replyQueue') || REPLY_QUEUE;
    this.persistent =
      this.getOptionsProp(this.options, 'persistent') || RQM_DEFAULT_PERSISTENT;
    loadPackage('amqplib', ClientRMQ.name, () => require('amqplib'));
    rqmPackage = loadPackage('amqp-connection-manager', ClientRMQ.name, () =>
      require('amqp-connection-manager'),
    );

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public close(): void {
    this.channel && this.channel.close();
    this.client && this.client.close();
    this.channel = null;
    this.client = null;
  }

  public consumeChannel() {
    const noAck = this.getOptionsProp(this.options, 'noAck', RQM_DEFAULT_NOACK);
    this.channel.addSetup((channel: any) =>
      channel.consume(
        this.replyQueue,
        (msg: any) =>
          this.responseEmitter.emit(msg.properties.correlationId, msg),
        {
          noAck,
        },
      ),
    );
  }

  public connect(): Promise<any> {
    if (this.client) {
      return this.connection;
    }
    this.client = this.createClient();
    this.handleError(this.client);
    this.handleDisconnectError(this.client);

    const connect$ = this.connect$(this.client);
    this.connection = lastValueFrom(
      this.mergeDisconnectEvent(this.client, connect$).pipe(
        switchMap(() => this.createChannel()),
        share(),
      ),
    ).catch(err => {
      if (err instanceof EmptyError) {
        return;
      }
      throw err;
    });

    return this.connection;
  }

  public createChannel(): Promise<void> {
    return new Promise(resolve => {
      this.channel = this.client.createChannel({
        json: false,
        setup: (channel: any) => this.setupChannel(channel, resolve),
      });
    });
  }

  public createClient<T = any>(): T {
    const socketOptions = this.getOptionsProp(this.options, 'socketOptions');
    return rqmPackage.connect(this.urls, {
      connectionOptions: socketOptions,
    }) as T;
  }

  public mergeDisconnectEvent<T = any>(
    instance: any,
    source$: Observable<T>,
  ): Observable<T> {
    const close$ = fromEvent(instance, DISCONNECT_EVENT).pipe(
      map((err: any) => {
        throw err;
      }),
    );
    return merge(source$, close$).pipe(first());
  }

  public async setupChannel(channel: any, resolve: Function) {
    const prefetchCount =
      this.getOptionsProp(this.options, 'prefetchCount') ||
      RQM_DEFAULT_PREFETCH_COUNT;
    const isGlobalPrefetchCount =
      this.getOptionsProp(this.options, 'isGlobalPrefetchCount') ||
      RQM_DEFAULT_IS_GLOBAL_PREFETCH_COUNT;

    await channel.assertQueue(this.queue, this.queueOptions);
    await channel.prefetch(prefetchCount, isGlobalPrefetchCount);

    this.responseEmitter = new EventEmitter();
    this.responseEmitter.setMaxListeners(0);
    this.consumeChannel();
    resolve();
  }

  public handleError(client: any): void {
    client.addListener(ERROR_EVENT, (err: any) => this.logger.error(err));
  }

  public handleDisconnectError(client: any): void {
    client.addListener(DISCONNECT_EVENT, (err: any) => {
      this.logger.error(DISCONNECTED_RMQ_MESSAGE);
      this.logger.error(err);

      this.close();
    });
  }

  public async handleMessage(
    packet: unknown,
    callback: (packet: WritePacket) => any,
  ) {
    const { err, response, isDisposed } = await this.deserializer.deserialize(
      packet,
    );
    if (isDisposed || err) {
      callback({
        err,
        response,
        isDisposed: true,
      });
    }
    callback({
      err,
      response,
    });
  }

  protected publish(
    message: ReadPacket,
    callback: (packet: WritePacket) => any,
  ): () => void {
    try {
      const correlationId = randomStringGenerator();
      const listener = ({ content }: { content: any }) =>
        this.handleMessage(JSON.parse(content.toString()), callback);

      Object.assign(message, { id: correlationId });
      const serializedPacket = this.serializer.serialize(message);

      this.responseEmitter.on(correlationId, listener);
      this.channel.sendToQueue(
        this.queue,
        Buffer.from(JSON.stringify(serializedPacket)),
        {
          replyTo: this.replyQueue,
          correlationId,
          persistent: this.persistent,
        },
      );
      return () => this.responseEmitter.removeListener(correlationId, listener);
    } catch (err) {
      callback({ err });
    }
  }

  protected dispatchEvent(packet: ReadPacket): Promise<any> {
    const serializedPacket = this.serializer.serialize(packet);

    return new Promise<void>((resolve, reject) =>
      this.channel.sendToQueue(
        this.queue,
        Buffer.from(JSON.stringify(serializedPacket)),
        {
          persistent: this.persistent,
        },
        (err: unknown) => (err ? reject(err) : resolve()),
      ),
    );
  }
}
