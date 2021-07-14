import { isString, isUndefined } from '@nestjs/common/utils/shared.utils';
import * as net from 'net';
import * as tls from 'tls';
import { Server as NetSocket, Socket } from 'net';
import { Observable } from 'rxjs';
import {
  CLOSE_EVENT,
  EADDRINUSE,
  ECONNREFUSED,
  ERROR_EVENT,
  MESSAGE_EVENT,
  NO_MESSAGE_HANDLER,
  TCP_DEFAULT_HOST,
  TCP_DEFAULT_PORT,
  TCP_DEFAULT_USE_TLS,
} from '../constants';
import { TcpContext } from '../ctx-host/tcp.context';
import { Transport } from '../enums';
import { JsonSocket } from '../helpers/json-socket';
import {
  CustomTransportStrategy,
  IncomingRequest,
  PacketId,
  ReadPacket,
  WritePacket,
} from '../interfaces';
import {
  TcpOptions,
  TcpTlsOptions,
} from '../interfaces/microservice-configuration.interface';
import { Server } from './server';

export class ServerTCP extends Server implements CustomTransportStrategy {
  public readonly transportId = Transport.TCP;

  private readonly port: number;
  private readonly host: string;
  private readonly useTls: boolean;
  private server: NetSocket;
  private isExplicitlyTerminated = false;
  private retryAttemptsCount = 0;

  constructor(options: TcpOptions['options']);
  constructor(options: TcpTlsOptions['options']);
  constructor(
    private readonly options: TcpOptions['options'] | TcpTlsOptions['options'],
  ) {
    super();
    this.port = this.getOptionsProp(options, 'port') || TCP_DEFAULT_PORT;
    this.host = this.getOptionsProp(options, 'host') || TCP_DEFAULT_HOST;
    this.useTls = this.getOptionsProp(options, 'useTls') || TCP_DEFAULT_USE_TLS;

    this.init();
    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public listen(
    callback: (err?: unknown, ...optionalParams: unknown[]) => void,
  ) {
    this.server.once(ERROR_EVENT, (err: Record<string, unknown>) => {
      if (err?.code === EADDRINUSE || err?.code === ECONNREFUSED) {
        return callback(err);
      }
    });
    this.server.listen(this.port, this.host, callback as () => void);
  }

  public close() {
    this.isExplicitlyTerminated = true;
    this.server.close();
  }

  public bindHandler(socket: Socket) {
    const readSocket = this.getSocketInstance(socket);
    readSocket.on(MESSAGE_EVENT, async (msg: ReadPacket & PacketId) =>
      this.handleMessage(readSocket, msg),
    );
    readSocket.on(ERROR_EVENT, this.handleError.bind(this));
  }

  public async handleMessage(socket: JsonSocket, rawMessage: unknown) {
    const packet = this.deserializer.deserialize(rawMessage);
    const pattern = !isString(packet.pattern)
      ? JSON.stringify(packet.pattern)
      : packet.pattern;

    const tcpContext = new TcpContext([socket, pattern]);
    if (isUndefined((packet as IncomingRequest).id)) {
      return this.handleEvent(pattern, packet, tcpContext);
    }
    const handler = this.getHandlerByPattern(pattern);
    if (!handler) {
      const status = 'error';
      const noHandlerPacket = this.serializer.serialize({
        id: (packet as IncomingRequest).id,
        status,
        err: NO_MESSAGE_HANDLER,
      });
      return socket.sendMessage(noHandlerPacket);
    }
    const response$ = this.transformToObservable(
      await handler(packet.data, tcpContext),
    ) as Observable<any>;

    response$ &&
      this.send(response$, data => {
        Object.assign(data, { id: (packet as IncomingRequest).id });
        const outgoingResponse = this.serializer.serialize(
          data as WritePacket & PacketId,
        );
        socket.sendMessage(outgoingResponse);
      });
  }

  public handleClose(): undefined | number | NodeJS.Timer {
    if (
      this.isExplicitlyTerminated ||
      !this.getOptionsProp(this.options, 'retryAttempts') ||
      this.retryAttemptsCount >=
        this.getOptionsProp(this.options, 'retryAttempts')
    ) {
      return undefined;
    }
    ++this.retryAttemptsCount;
    return setTimeout(
      () => this.server.listen(this.port),
      this.getOptionsProp(this.options, 'retryDelay') || 0,
    );
  }

  private init() {
    if (this.useTls) {
      // TLS enabled, use tls server
      const options = this.options as TcpTlsOptions['options'];
      this.server = tls.createServer(options, this.bindHandler.bind(this));
    } else {
      // TLS disabled, use net server
      this.server = net.createServer(this.bindHandler.bind(this));
    }
    this.server.on(ERROR_EVENT, this.handleError.bind(this));
    this.server.on(CLOSE_EVENT, this.handleClose.bind(this));
  }

  private getSocketInstance(socket: Socket): JsonSocket {
    return new JsonSocket(socket);
  }
}
