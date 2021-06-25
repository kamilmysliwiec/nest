import {
  HttpServer,
  INestApplication,
  INestMicroservice,
  Logger,
  NestApplicationOptions,
  Scope,
  Type,
} from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { NestMicroserviceOptions } from '@nestjs/common/interfaces/microservices/nest-microservice-options.interface';
import { NestApplicationContextOptions } from '@nestjs/common/interfaces/nest-application-context-options.interface';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import {
  AbstractHttpAdapter,
  ModuleRef,
  NestApplication,
  NestApplicationContext,
} from '@nestjs/core';
import { ApplicationConfig } from '@nestjs/core/application-config';
import {
  ExternalContextCreator,
  ParamsFactory,
} from '@nestjs/core/helpers/external-context-creator';
import { NestContainer } from '@nestjs/core/injector/container';
import { Module } from '@nestjs/core/injector/module';
import { RouteParamsFactory } from '@nestjs/core/router/route-params-factory';
import { PARAM_ARGS_METADATA as RPC_PARAMS_ARGS_METADATA } from '@nestjs/microservices/constants';
import { PARAM_ARGS_METADATA as WS_PARAMS_ARGS_METADATA } from '@nestjs/websockets/constants';
import { RpcParamsFactory } from '@nestjs/microservices/factories/rpc-params-factory';
import { WsParamsFactory } from '@nestjs/websockets/factories/ws-params-factory';

import { HttpTestingHandler } from './handlers/http-testing-handler';
import { RpcTestingHandler } from './handlers/rpc-testing-handler';
import { WsTestingHandler } from './handlers/ws-testing-handler';
import { MethodProperty } from './types/method-property';

export class TestingModule extends NestApplicationContext {
  constructor(
    container: NestContainer,
    scope: Type<any>[],
    contextModule: Module,
    private readonly applicationConfig: ApplicationConfig,
  ) {
    super(container, scope, contextModule);
  }

  public createNestApplication<T extends INestApplication = INestApplication>(
    httpAdapter?: HttpServer | AbstractHttpAdapter,
    options?: NestApplicationOptions,
  ): T {
    httpAdapter = httpAdapter || this.createHttpAdapter();

    this.applyLogger(options);
    this.container.setHttpAdapter(httpAdapter);

    const instance = new NestApplication(
      this.container,
      httpAdapter,
      this.applicationConfig,
      options,
    );
    return this.createAdapterProxy<T>(instance, httpAdapter);
  }

  public createNestMicroservice<T extends object>(
    options: NestMicroserviceOptions & T,
  ): INestMicroservice {
    const { NestMicroservice } = loadPackage(
      '@nestjs/microservices',
      'TestingModule',
      () => require('@nestjs/microservices'),
    );
    this.applyLogger(options);
    return new NestMicroservice(
      this.container,
      options,
      this.applicationConfig,
    );
  }

  /**
   * Allow testing the behavior of the execution chain (pipes, guards,
   * interceptors...) of a specific HTTP controller.
   *
   * @param params Controller class and method name.
   *
   * @example
   * await Test
   *  .createHttpHandler({ class: DogsController, methodName: 'getById' })
   *  .setRequest({ params: { id: 1 } })
   *  .run();
   */
  public createHttpHandler<TOutput, TClass>(params: {
    class: Type<TClass>;
    methodName: MethodProperty<TClass>;
  }) {
    const CustomParamsFactory = class implements ParamsFactory {
      private readonly routeParamsFactory = new RouteParamsFactory();

      exchangeKeyForValue(
        type: number,
        data: string | object | any,
        args: any[],
      ) {
        const [req, res, next] = args;
        return this.routeParamsFactory.exchangeKeyForValue(type, data, {
          res,
          req,
          next,
        });
      }
    };

    const createContext = () => {
      const { scope } = this.get(ModuleRef).introspect(params.class);
      if (scope === Scope.REQUEST) {
        // TODO: Kamil's gonna do something here, for Request-scoped instances
      }

      return this.get(ExternalContextCreator).create(
        this.get(params.class),
        this.get(params.class)[params.methodName] as any,
        params.methodName as string,
        ROUTE_ARGS_METADATA,
        new CustomParamsFactory(),
        undefined,
        undefined,
        undefined,
        'http',
      );
    };

    return HttpTestingHandler.create<TOutput>(createContext);
  }

  /**
   * Allow testing the behavior of the execution chain (pipes, guards,
   * interceptors...) of a specific RPC controller (micro-services).
   *
   * @param params Controller class and method name.
   *
   * @example
   * await Test
   *  .createRpcHandler({ class: DogsController, methodName: 'getById' })
   *  .setData({ id: 1 })
   *  .setContext({ getSubject: () => 'time.us.east' })
   *  .run();
   */
  public createRpcHandler<TOutput, TClass>(params: {
    class: Type<TClass>;
    methodName: MethodProperty<TClass>;
  }) {
    const createContext = () => {
      const { scope } = this.get(ModuleRef).introspect(params.class);
      if (scope === Scope.REQUEST) {
        // TODO: Kamil's gonna do something here, for Request-scoped instances
      }

      return this.get(ExternalContextCreator).create(
        this.get(params.class),
        this.get(params.class)[params.methodName] as any,
        params.methodName as string,
        RPC_PARAMS_ARGS_METADATA,
        new RpcParamsFactory(),
        undefined,
        undefined,
        undefined,
        'rpc',
      );
    };

    return RpcTestingHandler.create<TOutput>(createContext);
  }

  /**
   * Allow testing the behavior of the execution chain (pipes, guards,
   * interceptors...) of a specific WebSocket gateway.
   *
   * @param params Gateway class and method name.
   *
   * @example
   * await Test
   *  .createWsHandler({ class: EventsGateway, methodName: 'identity' })
   *  .setClient(mockedSocketClient)
   *  .setData({ id: '69132f77-cb41-4137-aa06-20683cef55cc' })
   *  .run();
   */
  public createWsHandler<TOutput, TClass>(params: {
    class: Type<TClass>;
    methodName: MethodProperty<TClass>;
  }) {
    const createContext = () => {
      const { scope } = this.get(ModuleRef).introspect(params.class);
      if (scope === Scope.REQUEST) {
        // TODO: Kamil's gonna do something here, for Request-scoped instances
      }

      return this.get(ExternalContextCreator).create(
        this.get(params.class),
        this.get(params.class)[params.methodName] as any,
        params.methodName as string,
        WS_PARAMS_ARGS_METADATA,
        new WsParamsFactory(),
        undefined,
        undefined,
        undefined,
        'ws',
      );
    };

    return WsTestingHandler.create<TOutput>(createContext);
  }

  private createHttpAdapter<T = any>(httpServer?: T): AbstractHttpAdapter {
    const { ExpressAdapter } = loadPackage(
      '@nestjs/platform-express',
      'NestFactory',
      () => require('@nestjs/platform-express'),
    );
    return new ExpressAdapter(httpServer);
  }

  private applyLogger(options: NestApplicationContextOptions | undefined) {
    if (!options || !options.logger) {
      return;
    }
    Logger.overrideLogger(options.logger);
  }

  private createAdapterProxy<T>(app: NestApplication, adapter: HttpServer): T {
    return (new Proxy(app, {
      get: (receiver: Record<string, any>, prop: string) => {
        if (!(prop in receiver) && prop in adapter) {
          return adapter[prop];
        }
        return receiver[prop];
      },
    }) as any) as T;
  }
}
