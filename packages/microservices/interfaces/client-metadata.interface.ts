import { Type } from '@nestjs/common';
import { ClientProxy } from '../client';
import { Transport } from '../enums/transport.enum';
import { Deserializer } from './deserializer.interface';
import {
  GrpcOptions,
  KafkaOptions,
  MqttOptions,
  NatsOptions,
  RedisOptions,
  RmqOptions,
} from './microservice-configuration.interface';
import { Serializer } from './serializer.interface';
import { TLSSocketOptions } from 'tls';

export type ClientOptions =
  | RedisOptions
  | NatsOptions
  | MqttOptions
  | GrpcOptions
  | KafkaOptions
  | TcpClientOptions
  | TcpTlsClientOptions
  | RmqOptions;

export interface CustomClientOptions {
  customClass: Type<ClientProxy>;
  options?: Record<string, any>;
}

export interface TcpClientBaseOptions {
  host?: string;
  port?: number;
  serializer?: Serializer;
  deserializer?: Deserializer;
}

export interface TcpClientOptions {
  transport: Transport.TCP;
  options?: (TcpClientBaseOptions & { useTls?: false | undefined }) | undefined;
}

export interface TcpTlsClientOptions {
  transport: Transport.TCP;
  options: TcpClientBaseOptions & { useTls: true } & TLSSocketOptions;
}
