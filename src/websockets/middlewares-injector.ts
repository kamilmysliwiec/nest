import { ApplicationConfig } from '@nestjs/core/application-config';
import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception';
import { UnknownModuleException } from '@nestjs/core/errors/exceptions/unknown-module.exception';
import { InstanceWrapper, NestContainer } from '@nestjs/core/injector/container';
import { Injectable } from '@nestjs/core/interfaces/injectable.interface';
import { isFunction, isNil, isUndefined } from '@nestjs/core/utils/shared.utils';
import iterate from 'iterare';
import 'reflect-metadata';
import { GATEWAY_MIDDLEWARES } from './constants';
import { NestGateway } from './index';
import { GatewayMiddleware } from './interfaces/gateway-middleware.interface';

export class MiddlewaresInjector {
    constructor(
        private readonly container: NestContainer,
        private readonly config: ApplicationConfig) {}

    public inject(server, instance: NestGateway, module: string) {
        const adapter = this.config.getIoAdapter();
        if (!adapter.bindMiddleware) {
            return;
        }
        const opaqueTokens = this.reflectMiddlewaresTokens(instance);
        const modules = this.container.getModules();
        if (!modules.has(module)) {
            throw new UnknownModuleException();
        }
        const { components } = modules.get(module);
        this.applyMiddlewares(server, components, opaqueTokens);
    }

    public reflectMiddlewaresTokens(instance: NestGateway): any[] {
        const prototype = Object.getPrototypeOf(instance);
        return Reflect.getMetadata(GATEWAY_MIDDLEWARES, prototype.constructor) || [];
    }

    public applyMiddlewares(server, components: Map<string, InstanceWrapper<Injectable>>, tokens: any[]) {
        const adapter = this.config.getIoAdapter();
        iterate(tokens).map(token => this.bindMiddleware(token.name, components))
            .filter(middleware => !isNil(middleware))
            .forEach(middleware => adapter.bindMiddleware(server, middleware));
    }

    public bindMiddleware(token: string, components: Map<string, InstanceWrapper<Injectable>>) {
        if (!components.has(token)) {
            throw new RuntimeException();
        }
        const { instance } = components.get(token);
        if (!this.isGatewayMiddleware(instance)) return null;

        const middleware = instance.resolve();
        return isFunction(middleware) ? middleware.bind(instance) : null;
    }

    public isGatewayMiddleware(middleware: object): middleware is GatewayMiddleware {
        return !isUndefined((middleware as GatewayMiddleware).resolve);
    }
}
