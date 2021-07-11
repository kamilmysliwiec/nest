import { Logger } from '@nestjs/common';
import * as net from 'net';
import { EmptyError, lastValueFrom } from 'rxjs';
import { share, tap } from 'rxjs/operators';
import { TLSSocket } from 'tls';
import {
  CLOSE_EVENT,
  ECONNREFUSED,
  ERROR_EVENT,
  MESSAGE_EVENT,
  TCP_DEFAULT_HOST,
  TCP_DEFAULT_PORT,
  TCP_DEFAULT_USE_TLS,
} from '../constants';
import { JsonSocket } from '../helpers/json-socket';
import { PacketId, ReadPacket, WritePacket } from '../interfaces';
import {
  TcpClientOptions,
  TcpTlsClientOptions,
} from '../interfaces/client-metadata.interface';
import { ClientProxy } from './client-proxy';

export class ClientTCP extends ClientProxy {
  protected connection: Promise<any>;
  private readonly logger = new Logger(ClientTCP.name);
  private readonly port: number;
  private readonly host: string;
  private readonly useTls: boolean;
  private isConnected = false;
  private socket: JsonSocket;

  constructor();
  constructor(options: TcpClientOptions['options']);
  constructor(options: TcpTlsClientOptions['options']);
  constructor(
    private readonly options?:
      | TcpClientOptions['options']
      | TcpTlsClientOptions['options'],
  ) {
    super();
    if (options === undefined) {
      this.options = {};
    }
    this.port = this.getOptionsProp(options, 'port') || TCP_DEFAULT_PORT;
    this.host = this.getOptionsProp(options, 'host') || TCP_DEFAULT_HOST;
    this.useTls = this.getOptionsProp(options, 'useTls') || TCP_DEFAULT_USE_TLS;

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public connect(): Promise<any> {
    if (this.isConnected && this.connection) {
      return this.connection;
    }
    this.socket = this.createSocket();
    this.bindEvents(this.socket);

    const source$ = this.connect$(this.socket.netSocket).pipe(
      tap(() => {
        this.isConnected = true;
        this.socket.on(MESSAGE_EVENT, (buffer: WritePacket & PacketId) =>
          this.handleResponse(buffer),
        );
      }),
      share(),
    );

    this.socket.connect(this.port, this.host);
    this.connection = lastValueFrom(source$).catch(err => {
      if (err instanceof EmptyError) {
        return;
      }
      throw err;
    });

    return this.connection;
  }

  public handleResponse(buffer: unknown): void {
    const { err, response, isDisposed, id } =
      this.deserializer.deserialize(buffer);
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
  }

  public createSocket(): JsonSocket {
    let socket: net.Socket | TLSSocket = new net.Socket();

    /**
     * TLS enabled, "upgrade" the TCP Socket to TLS
     */
    if (this.useTls === true) {
      /**
       * Options are TcpTlsClientOptions
       */
      const options = this.options as TcpTlsClientOptions['options'];
      socket = new TLSSocket(socket, options);
    }
    return new JsonSocket(socket);
  }

  public close() {
    this.socket && this.socket.end();
    this.handleClose();
  }

  public bindEvents(socket: JsonSocket) {
    socket.on(
      ERROR_EVENT,
      (err: any) => err.code !== ECONNREFUSED && this.handleError(err),
    );
    socket.on(CLOSE_EVENT, () => this.handleClose());
  }

  public handleError(err: any) {
    this.logger.error(err);
  }

  public handleClose() {
    this.isConnected = false;
    this.socket = null;
  }

  protected publish(
    partialPacket: ReadPacket,
    callback: (packet: WritePacket) => any,
  ): () => void {
    try {
      const packet = this.assignPacketId(partialPacket);
      const serializedPacket = this.serializer.serialize(packet);

      this.routingMap.set(packet.id, callback);
      this.socket.sendMessage(serializedPacket);

      return () => this.routingMap.delete(packet.id);
    } catch (err) {
      callback({ err });
    }
  }

  protected async dispatchEvent(packet: ReadPacket): Promise<any> {
    const pattern = this.normalizePattern(packet.pattern);
    const serializedPacket = this.serializer.serialize({
      ...packet,
      pattern,
    });
    return this.socket.sendMessage(serializedPacket);
  }
}
