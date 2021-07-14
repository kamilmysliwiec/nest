import { isUndefined } from '@nestjs/common/utils/shared.utils';
import { Observable } from 'rxjs';
import {
  CONNECT_EVENT,
  ERROR_EVENT,
  MESSAGE_EVENT,
  MQTT_DEFAULT_URL,
  MQTT_SEPARATOR,
  MQTT_WILDCARD_ALL,
  MQTT_WILDCARD_SINGLE,
  NO_MESSAGE_HANDLER,
} from '../constants';
import { MqttContext } from '../ctx-host/mqtt.context';
import { Transport } from '../enums';
import { MqttClient } from '../external/mqtt-client.interface';
import {
  CustomTransportStrategy,
  IncomingRequest,
  MessageHandler,
  PacketId,
  ReadPacket,
} from '../interfaces';
import { MqttOptions } from '../interfaces/microservice-configuration.interface';
import { Server } from './server';

let mqttPackage: any = {};

export class ServerMqtt extends Server implements CustomTransportStrategy {
  public readonly transportId = Transport.MQTT;

  private readonly url: string;
  private mqttClient: MqttClient;

  constructor(private readonly options: MqttOptions['options']) {
    super();
    this.url = this.getOptionsProp(options, 'url') || MQTT_DEFAULT_URL;

    mqttPackage = this.loadPackage('mqtt', ServerMqtt.name, () =>
      require('mqtt'),
    );

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public async listen(
    callback: (err?: unknown, ...optionalParams: unknown[]) => void,
  ) {
    try {
      this.mqttClient = this.createMqttClient();
      this.start(callback);
    } catch (err) {
      callback(err);
    }
  }

  public start(
    callback: (err?: unknown, ...optionalParams: unknown[]) => void,
  ) {
    this.handleError(this.mqttClient);
    this.bindEvents(this.mqttClient);

    this.mqttClient.on(CONNECT_EVENT, () => callback());
  }

  public bindEvents(mqttClient: MqttClient) {
    mqttClient.on(MESSAGE_EVENT, this.getMessageHandler(mqttClient).bind(this));
    const registeredPatterns = [...this.messageHandlers.keys()];
    registeredPatterns.forEach(pattern => {
      const { isEventHandler } = this.messageHandlers.get(pattern);
      mqttClient.subscribe(
        isEventHandler ? pattern : this.getRequestPattern(pattern),
      );
    });
  }

  public close() {
    this.mqttClient && this.mqttClient.end();
  }

  public createMqttClient(): MqttClient {
    return mqttPackage.connect(this.url, this.options as MqttOptions);
  }

  public getMessageHandler(pub: MqttClient): Function {
    return async (
      channel: string,
      buffer: Buffer,
      originalPacket?: Record<string, any>,
    ) => this.handleMessage(channel, buffer, pub, originalPacket);
  }

  public async handleMessage(
    channel: string,
    buffer: Buffer,
    pub: MqttClient,
    originalPacket?: Record<string, any>,
  ): Promise<any> {
    const rawPacket = this.parseMessage(buffer.toString());
    const packet = await this.deserializer.deserialize(rawPacket, { channel });
    const mqttContext = new MqttContext([channel, originalPacket]);
    if (isUndefined((packet as IncomingRequest).id)) {
      return this.handleEvent(channel, packet, mqttContext);
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
      await handler(packet.data, mqttContext),
    ) as Observable<any>;
    response$ && this.send(response$, publish);
  }

  public getPublisher(client: MqttClient, pattern: any, id: string): any {
    return (response: any) => {
      Object.assign(response, { id });
      const outgoingResponse = this.serializer.serialize(response);

      return client.publish(
        this.getReplyPattern(pattern),
        JSON.stringify(outgoingResponse),
      );
    };
  }

  public parseMessage(content: any): ReadPacket & PacketId {
    try {
      return JSON.parse(content);
    } catch (e) {
      return content;
    }
  }

  public matchMqttPattern(pattern: string, topic: string) {
    const patternSegments = pattern.split(MQTT_SEPARATOR);
    const topicSegments = topic.split(MQTT_SEPARATOR);

    const patternSegmentsLength = patternSegments.length;
    const topicSegmentsLength = topicSegments.length;
    const lastIndex = patternSegmentsLength - 1;

    for (let i = 0; i < patternSegmentsLength; i++) {
      const currentPattern = patternSegments[i];
      const patternChar = currentPattern[0];
      const currentTopic = topicSegments[i];

      if (!currentTopic && !currentPattern) {
        continue;
      }
      if (!currentTopic && currentPattern !== MQTT_WILDCARD_ALL) {
        return false;
      }
      if (patternChar === MQTT_WILDCARD_ALL) {
        return i === lastIndex;
      }
      if (
        patternChar !== MQTT_WILDCARD_SINGLE &&
        currentPattern !== currentTopic
      ) {
        return false;
      }
    }
    return patternSegmentsLength === topicSegmentsLength;
  }

  public getHandlerByPattern(pattern: string): MessageHandler | null {
    const route = this.getRouteFromPattern(pattern);
    if (this.messageHandlers.has(route)) {
      return this.messageHandlers.get(route) || null;
    }

    for (const [key, value] of this.messageHandlers) {
      if (
        key.indexOf(MQTT_WILDCARD_SINGLE) === -1 &&
        key.indexOf(MQTT_WILDCARD_ALL) === -1
      ) {
        continue;
      }
      if (this.matchMqttPattern(key, route)) {
        return value;
      }
    }
    return null;
  }

  public getRequestPattern(pattern: string): string {
    return pattern;
  }

  public getReplyPattern(pattern: string): string {
    return `${pattern}/reply`;
  }

  public handleError(stream: any) {
    stream.on(ERROR_EVENT, (err: any) => this.logger.error(err));
  }
}
