import {
  CanActivate,
  ExceptionFilter,
  HttpServer,
  INestApplication,
  INestMicroservice,
  NestHybridApplicationOptions,
  NestInterceptor,
  PipeTransform,
  WebSocketAdapter,
} from '@nestjs/common';
import {
  CorsOptions,
  CorsOptionsDelegate,
} from '@nestjs/common/interfaces/external/cors-options.interface';
import { NestApplicationOptions } from '@nestjs/common/interfaces/nest-application-options.interface';
import { Logger } from '@nestjs/common/services/logger.service';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import { addLeadingSlash, isObject } from '@nestjs/common/utils/shared.utils';
import { iterate } from 'iterare';
import { platform } from 'os';
import { AbstractHttpAdapter } from './adapters';
import { ApplicationConfig } from './application-config';
import { MESSAGES } from './constants';
import { optionalRequire } from './helpers/optional-require';
import { NestContainer } from './injector/container';
import { MiddlewareContainer } from './middleware/container';
import { MiddlewareModule } from './middleware/middleware-module';
import { NestApplicationContext } from './nest-application-context';
import { Resolver } from './router/interfaces/resolver.interface';
import { RoutesResolver } from './router/routes-resolver';

const { SocketModule } = optionalRequire(
  '@nestjs/websockets/socket-module',
  () => require('@nestjs/websockets/socket-module'),
);
const {
  MicroservicesModule,
} = optionalRequire('@nestjs/microservices/microservices-module', () =>
  require('@nestjs/microservices/microservices-module'),
);

/**
 * @publicApi
 */
export class NestApplication
  extends NestApplicationContext
  implements INestApplication {
  private readonly logger = new Logger(NestApplication.name, true);
  private readonly middlewareModule = new MiddlewareModule();
  private readonly middlewareContainer = new MiddlewareContainer(
    this.container,
  );
  private readonly microservicesModule =
    MicroservicesModule && new MicroservicesModule();
  private readonly socketModule = SocketModule && new SocketModule();
  private readonly routesResolver: Resolver;
  private readonly microservices: any[] = [];
  private httpServer: any;
  private listenUrl: Promise<string>;

  constructor(
    container: NestContainer,
    private readonly httpAdapter: HttpServer,
    private readonly config: ApplicationConfig,
    private readonly appOptions: NestApplicationOptions = {},
  ) {
    super(container);

    this.selectContextModule();
    this.registerHttpServer();

    this.routesResolver = new RoutesResolver(
      this.container,
      this.config,
      this.injector,
    );
  }

  protected async dispose(): Promise<void> {
    this.socketModule && (await this.socketModule.close());
    this.microservicesModule && (await this.microservicesModule.close());
    this.httpAdapter && (await this.httpAdapter.close());

    await Promise.all(
      iterate(this.microservices).map(async microservice => {
        microservice.setIsTerminated(true);
        await microservice.close();
      }),
    );
  }

  public getHttpAdapter(): AbstractHttpAdapter {
    return this.httpAdapter as AbstractHttpAdapter;
  }

  public registerHttpServer() {
    this.httpServer = this.createServer();
  }

  public getUnderlyingHttpServer<T>(): T {
    return this.httpAdapter.getHttpServer();
  }

  public applyOptions() {
    if (!this.appOptions || !this.appOptions.cors) {
      return undefined;
    }
    const passCustomOptions =
      isObject(this.appOptions.cors) ||
      typeof this.appOptions.cors === 'function';
    if (!passCustomOptions) {
      return this.enableCors();
    }
    return this.enableCors(
      this.appOptions.cors as CorsOptions | CorsOptionsDelegate<any>,
    );
  }

  public createServer<T = any>(): T {
    this.httpAdapter.initHttpServer(this.appOptions);
    return this.httpAdapter.getHttpServer() as T;
  }

  public async registerModules() {
    this.registerWsModule();

    if (this.microservicesModule) {
      this.microservicesModule.register(this.container, this.config);
      this.microservicesModule.setupClients(this.container);
    }
    await this.middlewareModule.register(
      this.middlewareContainer,
      this.container,
      this.config,
      this.injector,
      this.httpAdapter,
    );
  }

  public registerWsModule() {
    if (!this.socketModule) {
      return;
    }
    this.socketModule.register(this.container, this.config, this.httpServer);
  }

  public async init(): Promise<this> {
    this.applyOptions();
    await this.httpAdapter?.init();

    const useBodyParser =
      this.appOptions && this.appOptions.bodyParser !== false;
    useBodyParser && this.registerParserMiddleware();

    await this.registerModules();
    await this.registerRouter();
    await this.callInitHook();
    await this.registerRouterHooks();
    await this.callBootstrapHook();

    this.isInitialized = true;
    this.logger.log(MESSAGES.APPLICATION_READY);
    return this;
  }

  public registerParserMiddleware() {
    this.httpAdapter.registerParserMiddleware();
  }

  public async registerRouter() {
    await this.registerMiddleware(this.httpAdapter);

    const prefix = this.config.getGlobalPrefix();
    const basePath = addLeadingSlash(prefix);
    this.routesResolver.resolve(this.httpAdapter, basePath);
  }

  public async registerRouterHooks() {
    this.routesResolver.registerNotFoundHandler();
    this.routesResolver.registerExceptionHandler();
  }

  public connectMicroservice<T extends object>(
    microserviceOptions: T,
    hybridAppOptions: NestHybridApplicationOptions = {},
  ): INestMicroservice {
    const { NestMicroservice } = loadPackage(
      '@nestjs/microservices',
      'NestFactory',
      () => require('@nestjs/microservices'),
    );
    const { inheritAppConfig } = hybridAppOptions;
    const applicationConfig = inheritAppConfig
      ? this.config
      : new ApplicationConfig();

    const instance = new NestMicroservice(
      this.container,
      microserviceOptions,
      applicationConfig,
    );
    instance.registerListeners();
    instance.setIsInitialized(true);
    instance.setIsInitHookCalled(true);

    this.microservices.push(instance);
    return instance;
  }

  public getMicroservices(): INestMicroservice[] {
    return this.microservices;
  }

  public getHttpServer() {
    return this.httpServer;
  }

  public startAllMicroservices(callback?: () => void): this {
    Promise.all(this.microservices.map(this.listenToPromise)).then(
      () => callback && callback(),
    );
    return this;
  }

  public startAllMicroservicesAsync(): Promise<void> {
    return new Promise(resolve => this.startAllMicroservices(resolve));
  }

  public use(...args: [any, any?]): this {
    this.httpAdapter.use(...args);
    return this;
  }

  public enableCors(options?: CorsOptions | CorsOptionsDelegate<any>): void {
    this.httpAdapter.enableCors(options);
  }

  public async listen(
    port: number | string,
    callback?: () => void,
  ): Promise<any>;
  public async listen(
    port: number | string,
    hostname: string,
    callback?: () => void,
  ): Promise<any>;
  public async listen(port: number | string, ...args: any[]): Promise<any> {
    !this.isInitialized && (await this.init());
    this.listenForServerUrl();
    this.httpAdapter.listen(port, ...args);
    return this.httpServer;
  }

  public listenAsync(port: number | string, hostname?: string): Promise<any> {
    return new Promise(resolve => {
      const server: any = this.listen(port, hostname, () => resolve(server));
    });
  }

  public getUrl(): Promise<string> {
    if (!this.listenUrl) {
      this.logger.error(MESSAGES.CALL_LISTEN_FIRST);
      return Promise.reject(MESSAGES.CALL_LISTEN_FIRST);
    }
    return this.listenUrl;
  }

  public setGlobalPrefix(prefix: string): this {
    this.config.setGlobalPrefix(prefix);
    return this;
  }

  public useWebSocketAdapter(adapter: WebSocketAdapter): this {
    this.config.setIoAdapter(adapter);
    return this;
  }

  public useGlobalFilters(...filters: ExceptionFilter[]): this {
    this.config.useGlobalFilters(...filters);
    return this;
  }

  public useGlobalPipes(...pipes: PipeTransform<any>[]): this {
    this.config.useGlobalPipes(...pipes);
    return this;
  }

  public useGlobalInterceptors(...interceptors: NestInterceptor[]): this {
    this.config.useGlobalInterceptors(...interceptors);
    return this;
  }

  public useGlobalGuards(...guards: CanActivate[]): this {
    this.config.useGlobalGuards(...guards);
    return this;
  }

  public useStaticAssets(options: any): this;
  public useStaticAssets(path: string, options?: any): this;
  public useStaticAssets(pathOrOptions: any, options?: any): this {
    this.httpAdapter.useStaticAssets &&
      this.httpAdapter.useStaticAssets(pathOrOptions, options);
    return this;
  }

  public setBaseViewsDir(path: string | string[]): this {
    this.httpAdapter.setBaseViewsDir && this.httpAdapter.setBaseViewsDir(path);
    return this;
  }

  public setViewEngine(engineOrOptions: any): this {
    this.httpAdapter.setViewEngine &&
      this.httpAdapter.setViewEngine(engineOrOptions);
    return this;
  }
  private host(): string | undefined {
    const address = this.httpServer.address();
    if (typeof address === 'string') {
      return undefined;
    }
    return address && address.address;
  }

  private getProtocol(): 'http' | 'https' {
    return this.appOptions && this.appOptions.httpsOptions ? 'https' : 'http';
  }

  private async registerMiddleware(instance: any) {
    await this.middlewareModule.registerMiddleware(
      this.middlewareContainer,
      instance,
    );
  }

  private listenToPromise(microservice: INestMicroservice) {
    return new Promise<void>(async resolve => {
      await microservice.listen(resolve);
    });
  }

  private listenForServerUrl() {
    this.listenUrl = new Promise((resolve) => {
      this.httpServer.on('listening', () => {
        const address = this.httpServer.address();
        if (typeof address === 'string') {
          if (platform() === 'win32') {
            return address;
          }
          const basePath = encodeURIComponent(address);
          return `${this.getProtocol()}+unix://${basePath}`;
        }
        let host = this.host();
        if (address && address.family === 'IPv6') {
          if (host === '::') {
            host = '[::1]';
          } else {
            host = `[${host}]`;
          }
        } else if (host === '0.0.0.0') {
          host = '127.0.0.1';
        }
        resolve(`${this.getProtocol()}://${host}:${address.port}`);
      });
    });
  }
}
