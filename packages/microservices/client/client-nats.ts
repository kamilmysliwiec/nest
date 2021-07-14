import { Logger } from '@nestjs/common/services/logger.service';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import { NATS_DEFAULT_URL } from '../constants';
import { NatsResponseJSONDeserializer } from '../deserializers/nats-response-json.deserializer';
import { Client, NatsMsg } from '../external/nats-client.interface';
import { NatsOptions, PacketId, ReadPacket, WritePacket } from '../interfaces';
import { NatsJSONSerializer } from '../serializers/nats-json.serializer';
import { ClientProxy } from './client-proxy';

let natsPackage = {} as any;

export class ClientNats extends ClientProxy {
  protected readonly logger = new Logger(ClientProxy.name);
  protected natsClient: Client;

  constructor(protected readonly options: NatsOptions['options']) {
    super();
    natsPackage = loadPackage('nats', ClientNats.name, () => require('nats'));

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public async close() {
    await this.natsClient?.close();
    this.natsClient = null;
  }

  public async connect(): Promise<any> {
    if (this.natsClient) {
      return this.natsClient;
    }
    this.natsClient = await this.createClient();
    this.handleStatusUpdates(this.natsClient);
    return this.natsClient;
  }

  public createClient(): Promise<Client> {
    const options: any = this.options || ({} as NatsOptions);
    return natsPackage.connect({
      servers: NATS_DEFAULT_URL,
      ...options,
    });
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

  public createSubscriptionHandler(
    packet: ReadPacket & PacketId,
    callback: (packet: WritePacket) => any,
  ) {
    return async (error: unknown | undefined, natsMsg: NatsMsg) => {
      if (error) {
        return callback({
          err: error,
        });
      }
      const rawPacket = natsMsg.data;
      const message = await this.deserializer.deserialize(rawPacket);
      if (message.id && message.id !== packet.id) {
        return undefined;
      }
      const { err, response, isDisposed } = message;
      if (isDisposed || err) {
        return callback({
          err,
          response,
          isDisposed: true,
        });
      }
      callback({
        err,
        response,
      });
    };
  }

  protected publish(
    partialPacket: ReadPacket,
    callback: (packet: WritePacket) => any,
  ): () => void {
    try {
      const packet = this.assignPacketId(partialPacket);
      const channel = this.normalizePattern(partialPacket.pattern);
      const serializedPacket = this.serializer.serialize(packet);

      const subscriptionHandler = this.createSubscriptionHandler(
        packet,
        callback,
      );
      this.natsClient.publish(channel, serializedPacket, {
        reply: packet.id,
      });
      const subscription = this.natsClient.subscribe(packet.id, {
        callback: subscriptionHandler,
      });

      return () => subscription.unsubscribe();
    } catch (err) {
      callback({ err });
    }
  }

  protected dispatchEvent(packet: ReadPacket): Promise<any> {
    const pattern = this.normalizePattern(packet.pattern);
    const serializedPacket = this.serializer.serialize(packet);

    return new Promise<void>((resolve, reject) => {
      try {
        this.natsClient.publish(pattern, serializedPacket);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  protected initializeSerializer(options: NatsOptions['options']) {
    this.serializer = options?.serializer ?? new NatsJSONSerializer();
  }

  protected initializeDeserializer(options: NatsOptions['options']) {
    this.deserializer =
      options?.deserializer ?? new NatsResponseJSONDeserializer();
  }
}
