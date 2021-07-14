import { isUndefined } from '@nestjs/common/utils/shared.utils';
import { Observable } from 'rxjs';
import {
  CONNECT_EVENT,
  ERROR_EVENT,
  MESSAGE_EVENT,
  NO_MESSAGE_HANDLER,
  REDIS_DEFAULT_URL,
} from '../constants';
import { RedisContext } from '../ctx-host';
import { Transport } from '../enums';
import {
  ClientOpts,
  RedisClient,
  RetryStrategyOptions,
} from '../external/redis.interface';
import { CustomTransportStrategy, IncomingRequest } from '../interfaces';
import { RedisOptions } from '../interfaces/microservice-configuration.interface';
import { Server } from './server';

let redisPackage: any = {};

export class ServerRedis extends Server implements CustomTransportStrategy {
  public readonly transportId = Transport.REDIS;

  private readonly url: string;
  private subClient: RedisClient;
  private pubClient: RedisClient;
  private isExplicitlyTerminated = false;

  constructor(private readonly options: RedisOptions['options']) {
    super();
    this.url =
      this.getOptionsProp(options, 'url') ||
      (!this.getOptionsProp(options, 'host') && REDIS_DEFAULT_URL);

    redisPackage = this.loadPackage('redis', ServerRedis.name, () =>
      require('redis'),
    );

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public listen(
    callback: (err?: unknown, ...optionalParams: unknown[]) => void,
  ) {
    try {
      this.subClient = this.createRedisClient();
      this.pubClient = this.createRedisClient();

      this.handleError(this.pubClient);
      this.handleError(this.subClient);
      this.start(callback);
    } catch (err) {
      callback(err);
    }
  }

  public start(callback?: () => void) {
    this.bindEvents(this.subClient, this.pubClient);
    this.subClient.on(CONNECT_EVENT, callback);
  }

  public bindEvents(subClient: RedisClient, pubClient: RedisClient) {
    subClient.on(MESSAGE_EVENT, this.getMessageHandler(pubClient).bind(this));
    const subscribePatterns = [...this.messageHandlers.keys()];
    subscribePatterns.forEach(pattern => {
      const { isEventHandler } = this.messageHandlers.get(pattern);
      subClient.subscribe(
        isEventHandler ? pattern : this.getRequestPattern(pattern),
      );
    });
  }

  public close() {
    this.isExplicitlyTerminated = true;
    this.pubClient && this.pubClient.quit();
    this.subClient && this.subClient.quit();
  }

  public createRedisClient(): RedisClient {
    return redisPackage.createClient({
      ...this.getClientOptions(),
      url: this.url,
    });
  }

  public getMessageHandler(pub: RedisClient) {
    return async (channel: string, buffer: string | any) =>
      this.handleMessage(channel, buffer, pub);
  }

  public async handleMessage(
    channel: string,
    buffer: string | any,
    pub: RedisClient,
  ) {
    const rawMessage = this.parseMessage(buffer);
    const packet = await this.deserializer.deserialize(rawMessage, { channel });
    const redisCtx = new RedisContext([channel]);

    if (isUndefined((packet as IncomingRequest).id)) {
      return this.handleEvent(channel, packet, redisCtx);
    }
    const publish = this.getPublisher(
      pub,
      channel,
      (packet as IncomingRequest).id,
    );
    const handler = this.getHandlerByPattern(channel);

    if (!handler) {
      const status = 'error';
      const noHandlerPacket = {
        id: (packet as IncomingRequest).id,
        status,
        err: NO_MESSAGE_HANDLER,
      };
      return publish(noHandlerPacket);
    }
    const response$ = this.transformToObservable(
      await handler(packet.data, redisCtx),
    ) as Observable<any>;
    response$ && this.send(response$, publish);
  }

  public getPublisher(pub: RedisClient, pattern: any, id: string) {
    return (response: any) => {
      Object.assign(response, { id });
      const outgoingResponse = this.serializer.serialize(response);

      return pub.publish(
        this.getReplyPattern(pattern),
        JSON.stringify(outgoingResponse),
      );
    };
  }

  public parseMessage(content: any): Record<string, any> {
    try {
      return JSON.parse(content);
    } catch (e) {
      return content;
    }
  }

  public getRequestPattern(pattern: string): string {
    return pattern;
  }

  public getReplyPattern(pattern: string): string {
    return `${pattern}.reply`;
  }

  public handleError(stream: any) {
    stream.on(ERROR_EVENT, (err: any) => this.logger.error(err));
  }

  public getClientOptions(): Partial<ClientOpts> {
    const retry_strategy = (options: RetryStrategyOptions) =>
      this.createRetryStrategy(options);

    return {
      ...(this.options || {}),
      retry_strategy,
    };
  }

  public createRetryStrategy(
    options: RetryStrategyOptions,
  ): undefined | number | void {
    if (options.error && (options.error as any).code === 'ECONNREFUSED') {
      this.logger.error(`Error ECONNREFUSED: ${this.url}`);
    }
    if (this.isExplicitlyTerminated) {
      return undefined;
    }
    if (
      !this.getOptionsProp(this.options, 'retryAttempts') ||
      options.attempt > this.getOptionsProp(this.options, 'retryAttempts')
    ) {
      this.logger.error(`Retry time exhausted: ${this.url}`);
      throw new Error('Retry time exhausted');
    }
    return this.getOptionsProp(this.options, 'retryDelay') || 0;
  }
}
