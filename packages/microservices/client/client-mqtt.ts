import { Logger } from '@nestjs/common/services/logger.service';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import { EmptyError, fromEvent, lastValueFrom, merge, Observable } from 'rxjs';
import { first, map, share, tap } from 'rxjs/operators';
import {
  CLOSE_EVENT,
  ECONNREFUSED,
  ERROR_EVENT,
  MESSAGE_EVENT,
  MQTT_DEFAULT_URL,
} from '../constants';
import { MqttClient } from '../external/mqtt-client.interface';
import { MqttOptions, ReadPacket, WritePacket } from '../interfaces';
import { ClientProxy } from './client-proxy';

let mqttPackage: any = {};

export class ClientMqtt extends ClientProxy {
  protected readonly logger = new Logger(ClientProxy.name);
  protected readonly subscriptionsCount = new Map<string, number>();
  protected readonly url: string;
  protected mqttClient: MqttClient;
  protected connection: Promise<any>;

  constructor(protected readonly options: MqttOptions['options']) {
    super();
    this.url = this.getOptionsProp(this.options, 'url') || MQTT_DEFAULT_URL;

    mqttPackage = loadPackage('mqtt', ClientMqtt.name, () => require('mqtt'));

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public getRequestPattern(pattern: string): string {
    return pattern;
  }

  public getResponsePattern(pattern: string): string {
    return `${pattern}/reply`;
  }

  public close() {
    this.mqttClient && this.mqttClient.end();
    this.mqttClient = null;
    this.connection = null;
  }

  public connect(): Promise<any> {
    if (this.mqttClient) {
      return this.connection;
    }
    this.mqttClient = this.createClient();
    this.handleError(this.mqttClient);

    const connect$ = this.connect$(this.mqttClient);
    this.connection = lastValueFrom(
      this.mergeCloseEvent(this.mqttClient, connect$).pipe(
        tap(() =>
          this.mqttClient.on(MESSAGE_EVENT, this.createResponseCallback()),
        ),
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

  public mergeCloseEvent<T = any>(
    instance: MqttClient,
    source$: Observable<T>,
  ): Observable<T> {
    const close$ = fromEvent(instance, CLOSE_EVENT).pipe(
      map((err: any) => {
        throw err;
      }),
    );
    return merge(source$, close$).pipe(first());
  }

  public createClient(): MqttClient {
    return mqttPackage.connect(this.url, this.options as MqttOptions);
  }

  public handleError(client: MqttClient) {
    client.addListener(
      ERROR_EVENT,
      (err: any) => err.code !== ECONNREFUSED && this.logger.error(err),
    );
  }

  public createResponseCallback(): (channel: string, buffer: Buffer) => any {
    return async (channel: string, buffer: Buffer) => {
      const packet = JSON.parse(buffer.toString());
      const { err, response, isDisposed, id } =
        await this.deserializer.deserialize(packet);

      const callback = this.routingMap.get(id);
      if (!callback) {
        return undefined;
      }
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
      const pattern = this.normalizePattern(partialPacket.pattern);
      const serializedPacket = this.serializer.serialize(packet);
      const responseChannel = this.getResponsePattern(pattern);
      let subscriptionsCount =
        this.subscriptionsCount.get(responseChannel) || 0;

      const publishPacket = () => {
        subscriptionsCount = this.subscriptionsCount.get(responseChannel) || 0;
        this.subscriptionsCount.set(responseChannel, subscriptionsCount + 1);
        this.routingMap.set(packet.id, callback);
        this.mqttClient.publish(
          this.getRequestPattern(pattern),
          JSON.stringify(serializedPacket),
        );
      };

      if (subscriptionsCount <= 0) {
        this.mqttClient.subscribe(
          responseChannel,
          (err: any) => !err && publishPacket(),
        );
      } else {
        publishPacket();
      }

      return () => {
        this.unsubscribeFromChannel(responseChannel);
        this.routingMap.delete(packet.id);
      };
    } catch (err) {
      callback({ err });
    }
  }

  protected dispatchEvent(packet: ReadPacket): Promise<any> {
    const pattern = this.normalizePattern(packet.pattern);
    const serializedPacket = this.serializer.serialize(packet);

    return new Promise<void>((resolve, reject) =>
      this.mqttClient.publish(pattern, JSON.stringify(serializedPacket), err =>
        err ? reject(err) : resolve(),
      ),
    );
  }

  protected unsubscribeFromChannel(channel: string) {
    const subscriptionCount = this.subscriptionsCount.get(channel);
    this.subscriptionsCount.set(channel, subscriptionCount - 1);

    if (subscriptionCount - 1 <= 0) {
      this.mqttClient.unsubscribe(channel);
    }
  }
}
