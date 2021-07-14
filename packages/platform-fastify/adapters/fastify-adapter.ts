/* eslint-disable @typescript-eslint/no-var-requires */
import {
  HttpStatus,
  Logger,
  RequestMethod,
  StreamableFile,
} from '@nestjs/common';
import {
  CorsOptions,
  CorsOptionsDelegate,
} from '@nestjs/common/interfaces/external/cors-options.interface';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import { AbstractHttpAdapter } from '@nestjs/core/adapters/http-adapter';
import {
  fastify,
  FastifyInstance,
  FastifyLoggerInstance,
  FastifyPluginAsync,
  FastifyPluginCallback,
  FastifyPluginOptions,
  FastifyRegisterOptions,
  FastifyReply,
  FastifyRequest,
  FastifyServerOptions,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
  RequestGenericInterface,
} from 'fastify';
import * as Reply from 'fastify/lib/reply';
import * as http2 from 'http2';
import * as https from 'https';
import {
  Chain as LightMyRequestChain,
  InjectOptions,
  Response as LightMyRequestResponse,
} from 'light-my-request';
import {
  FastifyStaticOptions,
  PointOfViewOptions,
} from '../interfaces/external';

type FastifyHttp2SecureOptions<
  Server extends http2.Http2SecureServer,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance,
> = FastifyServerOptions<Server, Logger> & {
  http2: true;
  https: http2.SecureServerOptions;
};

type FastifyHttp2Options<
  Server extends http2.Http2Server,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance,
> = FastifyServerOptions<Server, Logger> & {
  http2: true;
  http2SessionTimeout?: number;
};

type FastifyHttpsOptions<
  Server extends https.Server,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance,
> = FastifyServerOptions<Server, Logger> & {
  https: https.ServerOptions;
};

/**
 * The following type assertion is valid as we enforce "middie" plugin registration
 * which enhances the FastifyRequest.RawRequest with the "originalUrl" property.
 * ref https://github.com/fastify/middie/pull/16
 * ref https://github.com/fastify/fastify/pull/559
 */
type FastifyRawRequest<TServer extends RawServerBase> =
  RawRequestDefaultExpression<TServer> & { originalUrl?: string };

export class FastifyAdapter<
  TServer extends RawServerBase = RawServerDefault,
  TRawRequest extends FastifyRawRequest<TServer> = FastifyRawRequest<TServer>,
  TRawResponse extends RawReplyDefaultExpression<TServer> = RawReplyDefaultExpression<TServer>,
  TRequest extends FastifyRequest<
    RequestGenericInterface,
    TServer,
    TRawRequest
  > = FastifyRequest<RequestGenericInterface, TServer, TRawRequest>,
  TReply extends FastifyReply<
    TServer,
    TRawRequest,
    TRawResponse
  > = FastifyReply<TServer, TRawRequest, TRawResponse>,
> extends AbstractHttpAdapter<TServer, TRequest, TReply> {
  protected readonly instance: FastifyInstance<
    TServer,
    TRawRequest,
    TRawResponse
  >;
  private _isParserRegistered: boolean;
  private isMiddieRegistered: boolean;

  get isParserRegistered(): boolean {
    return !!this._isParserRegistered;
  }

  constructor(
    instanceOrOptions:
      | FastifyInstance<TServer>
      | FastifyHttp2Options<any>
      | FastifyHttp2SecureOptions<any>
      | FastifyHttpsOptions<any>
      | FastifyServerOptions<TServer> = fastify() as any,
  ) {
    const instance =
      instanceOrOptions &&
      (instanceOrOptions as FastifyInstance<TServer>).server
        ? instanceOrOptions
        : fastify(instanceOrOptions as FastifyServerOptions);

    super(instance);
  }

  public async init() {
    if (this.isMiddieRegistered) {
      return;
    }
    await this.registerMiddie();
  }

  public listen(port: string | number, callback?: () => void): void;
  public listen(
    port: string | number,
    hostname: string,
    callback?: () => void,
  ): void;
  public listen(port: string | number, ...args: any[]): Promise<string> {
    return this.instance.listen(port, ...args);
  }

  public reply(
    response: TRawResponse | TReply,
    body: any,
    statusCode?: number,
  ) {
    const fastifyReply: TReply = this.isNativeResponse(response)
      ? new Reply(
          response,
          {
            context: {
              preSerialization: null,
              preValidation: [],
              preHandler: [],
              onSend: [],
              onError: [],
            },
          },
          {},
        )
      : response;

    if (statusCode) {
      fastifyReply.status(statusCode);
    }
    if (body instanceof StreamableFile) {
      body = body.getStream();
    }
    return fastifyReply.send(body);
  }

  public status(response: TRawResponse | TReply, statusCode: number) {
    if (this.isNativeResponse(response)) {
      response.statusCode = statusCode;
      return response;
    }
    return (response as TReply).code(statusCode);
  }

  public render(
    response: TReply & { view: Function },
    view: string,
    options: any,
  ) {
    return response && response.view(view, options);
  }

  public redirect(response: TReply, statusCode: number, url: string) {
    const code = statusCode ?? HttpStatus.FOUND;
    return response.status(code).redirect(url);
  }

  public setErrorHandler(
    handler: Parameters<
      FastifyInstance<TServer, TRawRequest, TRawResponse>['setErrorHandler']
    >[0],
  ) {
    return this.instance.setErrorHandler(handler);
  }

  public setNotFoundHandler(handler: Function) {
    return this.instance.setNotFoundHandler(handler as any);
  }

  public getHttpServer<T = TServer>(): T {
    return this.instance.server as unknown as T;
  }

  public getInstance<
    T = FastifyInstance<TServer, TRawRequest, TRawResponse>,
  >(): T {
    return this.instance as unknown as T;
  }

  public register<Options extends FastifyPluginOptions = any>(
    plugin:
      | FastifyPluginCallback<Options>
      | FastifyPluginAsync<Options>
      | Promise<{ default: FastifyPluginCallback<Options> }>
      | Promise<{ default: FastifyPluginAsync<Options> }>,
    opts?: FastifyRegisterOptions<Options>,
  ) {
    return this.instance.register(plugin, opts);
  }

  public inject(): LightMyRequestChain;
  public inject(opts: InjectOptions | string): Promise<LightMyRequestResponse>;
  public inject(
    opts?: InjectOptions | string,
  ): LightMyRequestChain | Promise<LightMyRequestResponse> {
    return this.instance.inject(opts);
  }

  public async close() {
    try {
      return await this.instance.close();
    } catch (err) {
      // Check if server is still running
      if (err.code !== 'ERR_SERVER_NOT_RUNNING') {
        throw err;
      }
      return;
    }
  }

  public initHttpServer() {
    this.httpServer = this.instance.server;
  }

  public useStaticAssets(options: FastifyStaticOptions) {
    return this.register(
      loadPackage('fastify-static', 'FastifyAdapter.useStaticAssets()'),
      options,
    );
  }

  public setViewEngine(options: PointOfViewOptions | string) {
    if (typeof options === 'string') {
      new Logger('FastifyAdapter').error(
        "setViewEngine() doesn't support a string argument.",
      );
      process.exit(1);
    }
    return this.register(
      loadPackage('point-of-view', 'FastifyAdapter.setViewEngine()'),
      options,
    );
  }

  public setHeader(response: TReply, name: string, value: string) {
    return response.header(name, value);
  }

  public getRequestHostname(request: TRequest): string {
    return request.hostname;
  }

  public getRequestMethod(request: TRequest): string {
    return request.raw ? request.raw.method : request.method;
  }

  public getRequestUrl(request: TRequest): string;
  public getRequestUrl(request: TRawRequest): string;
  public getRequestUrl(request: TRequest & TRawRequest): string {
    return this.getRequestOriginalUrl(request.raw || request);
  }

  public enableCors(options: CorsOptions | CorsOptionsDelegate<TRequest>) {
    if (typeof options === 'function') {
      this.register(require('fastify-cors'), () => options);
    } else {
      this.register(require('fastify-cors'), options);
    }
  }

  public registerParserMiddleware() {
    if (this._isParserRegistered) {
      return;
    }
    this.register(require('fastify-formbody'));
    this._isParserRegistered = true;
  }

  public async createMiddlewareFactory(
    requestMethod: RequestMethod,
  ): Promise<(path: string, callback: Function) => any> {
    if (!this.isMiddieRegistered) {
      await this.registerMiddie();
    }
    return (path: string, callback: Function) => {
      const normalizedPath = path.endsWith('/*')
        ? `${path.slice(0, -1)}(.*)`
        : path;

      // The following type assertion is valid as we use import('middie') rather than require('middie')
      // ref https://github.com/fastify/middie/pull/55
      this.instance.use(
        normalizedPath,
        (req: any, res: any, next: Function) => {
          if (
            requestMethod === RequestMethod.ALL ||
            req.method === RequestMethod[requestMethod] ||
            (requestMethod as number) === -1
          ) {
            return callback(req, res, next);
          }
          next();
        },
      );
    };
  }

  public getType(): string {
    return 'fastify';
  }

  protected registerWithPrefix(
    factory:
      | FastifyPluginCallback<any>
      | FastifyPluginAsync<any>
      | Promise<{ default: FastifyPluginCallback<any> }>
      | Promise<{ default: FastifyPluginAsync<any> }>,
    prefix = '/',
  ) {
    return this.instance.register(factory, { prefix });
  }

  private isNativeResponse(
    response: TRawResponse | TReply,
  ): response is TRawResponse {
    return !('status' in response);
  }

  private async registerMiddie() {
    this.isMiddieRegistered = true;
    await this.register(import('middie'));
  }

  private getRequestOriginalUrl(rawRequest: TRawRequest) {
    return rawRequest.originalUrl || rawRequest.url;
  }
}
