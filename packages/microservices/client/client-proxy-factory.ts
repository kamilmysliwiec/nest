import { Transport } from '../enums/transport.enum';
import {
  ClientOptions,
  CustomClientOptions,
  TcpClientOptions,
  TcpTlsClientOptions,
} from '../interfaces/client-metadata.interface';
import { Closeable } from '../interfaces/closeable.interface';
import {
  GrpcOptions,
  KafkaOptions,
  MqttOptions,
  NatsOptions,
  RedisOptions,
  RmqOptions,
} from '../interfaces/microservice-configuration.interface';
import { ClientGrpcProxy } from './client-grpc';
import { ClientKafka } from './client-kafka';
import { ClientMqtt } from './client-mqtt';
import { ClientNats } from './client-nats';
import { ClientProxy } from './client-proxy';
import { ClientRedis } from './client-redis';
import { ClientRMQ } from './client-rmq';
import { ClientTCP } from './client-tcp';

export interface IClientProxyFactory {
  create(clientOptions: ClientOptions): ClientProxy & Closeable;
}

export class ClientProxyFactory {
  public static create(
    clientOptions: { transport: Transport.GRPC } & ClientOptions,
  ): ClientGrpcProxy;
  public static create(clientOptions: ClientOptions): ClientProxy & Closeable;
  public static create(
    clientOptions: CustomClientOptions,
  ): ClientProxy & Closeable;
  public static create(
    clientOptions: ClientOptions | CustomClientOptions,
  ): ClientProxy & Closeable {
    if (this.isCustomClientOptions(clientOptions)) {
      const { customClass, options } = clientOptions;
      return new customClass(options);
    }
    const { transport, options } = clientOptions || {};
    switch (transport) {
      case Transport.REDIS:
        return new ClientRedis(options as RedisOptions['options']);
      case Transport.NATS:
        return new ClientNats(options as NatsOptions['options']);
      case Transport.MQTT:
        return new ClientMqtt(options as MqttOptions['options']);
      case Transport.GRPC:
        return new ClientGrpcProxy(options as GrpcOptions['options']);
      case Transport.RMQ:
        return new ClientRMQ(options as RmqOptions['options']);
      case Transport.KAFKA:
        return new ClientKafka(options as KafkaOptions['options']);
      default:
        const uncheckedOptions = options as
          | TcpClientOptions['options']
          | TcpTlsClientOptions['options']
          | undefined;
        if (uncheckedOptions && uncheckedOptions.useTls === true) {
          return new ClientTCP(options as TcpTlsClientOptions['options']);
        } else {
          return new ClientTCP(
            options as TcpClientOptions['options'] | undefined,
          );
        }
    }
  }

  private static isCustomClientOptions(
    options: ClientOptions | CustomClientOptions | undefined | null,
  ): options is CustomClientOptions {
    return options && !!(options as CustomClientOptions).customClass;
  }
}
