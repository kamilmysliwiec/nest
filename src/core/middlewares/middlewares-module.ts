import { MiddlewareWrapper, MiddlewaresContainer } from './container';
import { Request, Response } from 'express';

import { ApplicationConfig } from './../application-config';
import { ControllerMetadata } from '@nestjs/common/interfaces/controllers/controller-metadata.interface';
import { ExceptionsHandler } from '../exceptions/exceptions-handler';
import { InvalidMiddlewareException } from '../errors/exceptions/invalid-middleware.exception';
import { Metatype } from '@nestjs/common/interfaces/metatype.interface';
import { MiddlewareBuilder } from './builder';
import { MiddlewareConfiguration } from '@nestjs/common/interfaces/middlewares/middleware-configuration.interface';
import { MiddlewaresResolver } from './resolver';
import { Module } from '../injector/module';
import { NestContainer } from '../injector/container';
import { NestMiddleware } from '@nestjs/common/interfaces/middlewares/nest-middleware.interface';
import { NestModule } from '@nestjs/common/interfaces/modules/nest-module.interface';
import { NextFunction } from 'express-serve-static-core';
import { RequestMethod } from '@nestjs/common/enums/request-method.enum';
import { RouterExceptionFilters } from './../router/router-exception-filters';
import { RouterMethodFactory } from '../helpers/router-method-factory';
import { RouterProxy } from '../router/router-proxy';
import { RoutesMapper } from './routes-mapper';
import { RuntimeException } from '../errors/exceptions/runtime.exception';
import { isUndefined } from '@nestjs/common/utils/shared.utils';

export class MiddlewaresModule {
    private readonly routesMapper = new RoutesMapper();
    private readonly routerProxy = new RouterProxy();
    private readonly routerMethodFactory = new RouterMethodFactory();
    private routerExceptionFilter: RouterExceptionFilters;
    private resolver: MiddlewaresResolver;

    public async setup(
        middlewaresContainer: MiddlewaresContainer,
        container: NestContainer,
        config: ApplicationConfig,
    ) {
        this.routerExceptionFilter = new RouterExceptionFilters(config);
        this.resolver = new MiddlewaresResolver(middlewaresContainer);

        const modules = container.getModules();
        await this.resolveMiddlewares(middlewaresContainer, modules);
    }

    public async resolveMiddlewares(
        middlewaresContainer: MiddlewaresContainer,
        modules: Map<string, Module>,
    ) {
        await Promise.all([...modules.entries()].map(async ([name, module]) => {
            const instance = module.instance;

            this.loadConfiguration(middlewaresContainer, instance, name);
            await this.resolver.resolveInstances(module, name);
        }));
    }

    public loadConfiguration(
        middlewaresContainer: MiddlewaresContainer,
        instance: NestModule,
        module: string,
    ) {
        if (!instance.configure) return;

        const middlewaresBuilder = new MiddlewareBuilder(this.routesMapper);
        instance.configure(middlewaresBuilder);

        if (!(middlewaresBuilder instanceof MiddlewareBuilder)) return;

        const config = middlewaresBuilder.build();
        middlewaresContainer.addConfig(config, module);
    }

    public async setupMiddlewares(middlewaresContainer: MiddlewaresContainer, app: any) {
        const configs = middlewaresContainer.getConfigs();
        await Promise.all([...configs.entries()].map(async ([module, moduleConfigs]) => {
            await Promise.all([...moduleConfigs].map(async (config: MiddlewareConfiguration) => {
                await this.setupMiddlewareConfig(middlewaresContainer, config, module, app);
            }));
        }));
    }

    public async setupMiddlewareConfig(
        middlewaresContainer: MiddlewaresContainer,
        config: MiddlewareConfiguration,
        module: string,
        app: any,
    ) {
        const { forRoutes } = config;
        await Promise.all(forRoutes.map(async (route: ControllerMetadata & { method: RequestMethod }) => {
            await this.setupRouteMiddleware(middlewaresContainer, route, config, module, app);
        }));
    }

    public async setupRouteMiddleware(
        middlewaresContainer: MiddlewaresContainer,
        route: ControllerMetadata & { method: RequestMethod },
        config: MiddlewareConfiguration,
        module: string,
        app: any,
    ) {
        const { path, method } = route;

        const middlewares = [].concat(config.middlewares);
        await Promise.all(middlewares.map(async (metatype: Metatype<NestMiddleware>) => {
            const collection = middlewaresContainer.getMiddlewares(module);
            const middleware = collection.get(metatype.name);
            if (isUndefined(middleware)) {
                throw new RuntimeException();
            }

            const { instance } = (middleware as MiddlewareWrapper);
            await this.setupHandler(instance, metatype, app, method, path);
        }));
    }

    private async setupHandler(
        instance: NestMiddleware,
        metatype: Metatype<NestMiddleware>,
        app: any,
        method: RequestMethod,
        path: string) {

        if (isUndefined(instance.resolve)) {
            throw new InvalidMiddlewareException(metatype.name);
        }
        const exceptionsHandler = this.routerExceptionFilter.create(instance, instance.resolve);
        const router = this.routerMethodFactory.get(app, method).bind(app);

        const setupWithProxy = (middleware: any) => this.setupHandlerWithProxy(
            exceptionsHandler, router, middleware, path,
        );
        const resolve = instance.resolve();
        if (!(resolve instanceof Promise)) {
            setupWithProxy(resolve);
            return;
        }
        const resolvedInstance = await resolve;
        setupWithProxy(resolvedInstance);
    }

    private setupHandlerWithProxy(
        exceptionsHandler: ExceptionsHandler,
        router: (...args: any[]) => void,
        middleware: (req: Request & any, res: Response & any, next: NextFunction) => void,
        path: string) {

        const proxy = this.routerProxy.createProxy(middleware, exceptionsHandler);
        router(path, proxy);
    }
}
