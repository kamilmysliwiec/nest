import 'reflect-metadata';
import iterate from 'iterare';
import { Controller } from '@nestjs/common/interfaces';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { isUndefined, isFunction, isNil, isEmpty } from '@nestjs/common/utils/shared.utils';
import { ContextCreator } from './../helpers/context-creator';
import { NestContainer } from '../injector/container';
import { CanActivate } from '@nestjs/common';

export class GuardsContextCreator extends ContextCreator {
    private moduleContext: string;

    constructor(private readonly container: NestContainer) {
        super();
    }

    public create(instance: Controller, callback: (...args) => any, module: string): CanActivate[] {
        this.moduleContext = module;
        return this.createContext(instance, callback, GUARDS_METADATA);
    }

    public createConcreteContext<T extends any[], R extends any[]>(metadata: T[]): R {
        if (isUndefined(metadata) || isEmpty(metadata) || !this.moduleContext) {
            return [] as R;
        }
        return iterate(metadata).filter((metatype: any) => metatype && metatype.name)
                .map((metatype) => {
                    const allModules = this.container.getModules();
                    const module = allModules.get(this.moduleContext);
                    if (!module) {
                        return undefined;
                    }
                    return module.injectables.get((metatype as any).name);
                })
                .filter((wrapper: any) => wrapper && wrapper.instance)
                .map((wrapper) => wrapper.instance)
                .filter((guard: CanActivate) => guard && isFunction(guard.canActivate))
                .toArray() as R;
    }

    public getGlobalMetadata<T extends any[]>(): T {
        return [] as T;
    }
}