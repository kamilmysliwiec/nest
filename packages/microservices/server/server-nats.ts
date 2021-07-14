import { isUndefined } from '@nestjs/common/utils/shared.utils';
import { Observable } from 'rxjs';
import { NATS_DEFAULT_URL, NO_MESSAGE_HANDLER } from '../constants';
import { NatsContext } from '../ctx-host/nats.context';
import { NatsRequestJSONDeserializer } from '../deserializers/nats-request-json.deserializer';
import { Transport } from '../enums';
import { Client, NatsMsg } from '../external/nats-client.interface';
import { CustomTransportStrategy } from '../interfaces';
import { NatsOptions } from '../interfaces/microservice-configuration.interface';
import { IncomingRequest } from '../interfaces/packet.interface';
import { NatsJSONSerializer } from '../serializers/nats-json.serializer';
import { Server } from './server';

let natsPackage = {} as any;

export class ServerNats extends Server implements CustomTransportStrategy {
  public readonly transportId = Transport.NATS;

  private natsClient: Client;

  constructor(private readonly options: NatsOptions['options']) {
    super();

    natsPackage = this.loadPackage('nats', ServerNats.name, () =>
      require('nats'),
    );

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public async listen(
    callback: (err?: unknown, ...optionalParams: unknown[]) => void,
  ) {
    try {
      this.natsClient = await this.createNatsClient();
      this.handleStatusUpdates(this.natsClient);
      this.start(callback);
    } catch (err) {
      callback(err);
    }
  }

  public start(
    callback: (err?: unknown, ...optionalParams: unknown[]) => void,
  ) {
    this.bindEvents(this.natsClient);
    callback();
  }

  public bindEvents(client: Client) {
    const queue = this.getOptionsProp(this.options, 'queue');
    const subscribe = (channel: string) =>
      client.subscribe(channel, {
        queue,
        callback: this.getMessageHandler(channel).bind(this),
      });

    const registeredPatterns = [...this.messageHandlers.keys()];
    registeredPatterns.forEach(channel => subscribe(channel));
  }

  public async close() {
    await this.natsClient?.close();
    this.natsClient = null;
  }

  public createNatsClient(): Promise<Client> {
    const options = this.options || ({} as NatsOptions);
    return natsPackage.connect({
      servers: NATS_DEFAULT_URL,
      ...options,
    });
  }

  public getMessageHandler(channel: string): Function {
    return async (error: object | undefined, message: NatsMsg) => {
      if (error) {
        return this.logger.error(error);
      }
      return this.handleMessage(channel, message);
    };
  }

  public async handleMessage(channel: string, natsMsg: NatsMsg) {
    const callerSubject = natsMsg.subject;
    const rawMessage = natsMsg.data;
    const replyTo = natsMsg.reply;

    const natsCtx = new NatsContext([callerSubject, natsMsg.headers]);
    const message = await this.deserializer.deserialize(rawMessage, {
      channel,
      replyTo,
    });
    if (isUndefined((message as IncomingRequest).id)) {
      return this.handleEvent(channel, message, natsCtx);
    }
    const publish = this.getPublisher(natsMsg, (message as IncomingRequest).id);
    const handler = this.getHandlerByPattern(channel);
    if (!handler) {
      const status = 'error';
      const noHandlerPacket = {
        id: (message as IncomingRequest).id,
        status,
        err: NO_MESSAGE_HANDLER,
      };
      return publish(noHandlerPacket);
    }
    const response$ = this.transformToObservable(
      await handler(message.data, natsCtx),
    ) as Observable<any>;
    response$ && this.send(response$, publish);
  }

  public getPublisher(natsMsg: NatsMsg, id: string) {
    if (natsMsg.reply) {
      return (response: any) => {
        Object.assign(response, { id });
        const outgoingResponse = this.serializer.serialize(response);
        return natsMsg.respond(outgoingResponse);
      };
    }

    // In case the "reply" topic is not provided, there's no need for a reply.
    // Method returns a noop function instead
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  public async handleStatusUpdates(client: Client) {
    for await (const status of client.status()) {
      const data =
        status.data && typeof status.data === 'object'
          ? JSON.stringify(status.data)
          : status.data;
      if (status.type === 'disconnect' || status.type === 'error') {
        this.logger.error(
          `NatsError: type: "${status.type}", data: "${data}".`,
        );
      } else {
        this.logger.log(`NatsStatus: type: "${status.type}", data: "${data}".`);
      }
    }
  }

  protected initializeSerializer(options: NatsOptions['options']) {
    this.serializer = options?.serializer ?? new NatsJSONSerializer();
  }

  protected initializeDeserializer(options: NatsOptions['options']) {
    this.deserializer =
      options?.deserializer ?? new NatsRequestJSONDeserializer();
  }
}
