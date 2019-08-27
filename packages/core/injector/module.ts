import { Scope } from '@nestjs/common';
import { SCOPE_OPTIONS_METADATA } from '@nestjs/common/constants';
import {
  Abstract,
  ClassProvider,
  Controller,
  DynamicModule,
  ExistingProvider,
  FactoryProvider,
  Injectable,
  NestModule,
  Provider,
  ValueProvider,
} from '@nestjs/common/interfaces';
import { Type } from '@nestjs/common/interfaces/type.interface';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import {
  isFunction,
  isNil,
  isString,
  isSymbol,
  isUndefined,
} from '@nestjs/common/utils/shared.utils';
import { ApplicationConfig } from '../application-config';
import { InvalidClassException } from '../errors/exceptions/invalid-class.exception';
import { RuntimeException } from '../errors/exceptions/runtime.exception';
import { UnknownExportException } from '../errors/exceptions/unknown-export.exception';
import { createContextId } from '../helpers';
import { NestContainer } from './container';
import { InstanceWrapper } from './instance-wrapper';
import { ModuleRef } from './module-ref';
import { MixedMultiProviderException } from '../errors/exceptions/mixed-multi-provider.exception';

interface ProviderName {
  name?: string | symbol;
}

type CustomProvider = (
  | ClassProvider
  | FactoryProvider
  | ValueProvider
  | ExistingProvider) &
  ProviderName;

type MultiProvider = CustomProvider & {
  multi: true;
};

/**
 * The factory which will be used for multi providers
 */
const MULTI_PROVIDER_FACTORY = externalMultiProviderLength =>
  ((...args: any[]) =>
    args.reduce(
      (current: any[], next: any[] | any, index: number) =>
        // The external multi providers are already in an array => destruct them.
        index < externalMultiProviderLength
          ? [...current, ...next]
          : [...current, next],
      [],
    )) as any;

const MULTI_ELEMENT_PREFIX = 'MULTI_ELEMENT';
const MULTI_EXTERNAL_PREFIX = 'MULTI_EXTERNAL';
const getMultiExternalToken = (module: Module, token: string | symbol | any) =>
  `${MULTI_EXTERNAL_PREFIX}_${module.id}_${token.toString()}`;

export class Module {
  private readonly _id: string;
  private readonly _imports = new Set<Module>();
  private readonly _providers = new Map<any, InstanceWrapper<Injectable>>();
  private readonly _injectables = new Map<any, InstanceWrapper<Injectable>>();
  private readonly _controllers = new Map<
    string,
    InstanceWrapper<Controller>
  >();
  private readonly _exports = new Set<string | symbol>();
  private _distance: number = 0;

  constructor(
    private readonly _metatype: Type<any>,
    private readonly _scope: Type<any>[],
    private readonly container: NestContainer,
  ) {
    this.addCoreProviders(container);
    this._id = randomStringGenerator();
  }

  get id(): string {
    return this._id;
  }

  get scope(): Type<any>[] {
    return this._scope;
  }

  get providers(): Map<any, InstanceWrapper<Injectable>> {
    return this._providers;
  }

  get imports(): Set<Module> {
    return this._imports;
  }

  /**
   * Left for backward-compatibility reasons
   */
  get relatedModules(): Set<Module> {
    return this._imports;
  }

  /**
   * Left for backward-compatibility reasons
   */
  get components(): Map<string, InstanceWrapper<Injectable>> {
    return this._providers;
  }

  /**
   * Left for backward-compatibility reasons
   */
  get routes(): Map<string, InstanceWrapper<Controller>> {
    return this._controllers;
  }

  get injectables(): Map<string, InstanceWrapper<Injectable>> {
    return this._injectables;
  }

  get controllers(): Map<string, InstanceWrapper<Controller>> {
    return this._controllers;
  }

  get exports(): Set<string | symbol> {
    return this._exports;
  }

  get instance(): NestModule {
    if (!this._providers.has(this._metatype.name)) {
      throw new RuntimeException();
    }
    const module = this._providers.get(this._metatype.name);
    return module.instance as NestModule;
  }

  get metatype(): Type<any> {
    return this._metatype;
  }

  get distance(): number {
    return this._distance;
  }

  set distance(distance: number) {
    this._distance = distance;
    Array.from(this._imports)
      .filter(module => module && !module.imports.has(this))
      .forEach(module => (module.distance = distance + 1));
  }

  public addCoreProviders(container: NestContainer) {
    this.addModuleAsProvider();
    this.addModuleRef();
    this.addApplicationConfig();
  }

  public addModuleRef() {
    const moduleRef = this.createModuleReferenceType();
    this._providers.set(
      ModuleRef.name,
      new InstanceWrapper({
        name: ModuleRef.name,
        metatype: ModuleRef as any,
        isResolved: true,
        instance: new moduleRef(),
        host: this,
      }),
    );
  }

  public addModuleAsProvider() {
    this._providers.set(
      this._metatype.name,
      new InstanceWrapper({
        name: this._metatype.name,
        metatype: this._metatype,
        isResolved: false,
        instance: null,
        host: this,
      }),
    );
  }

  public addApplicationConfig() {
    this._providers.set(
      ApplicationConfig.name,
      new InstanceWrapper({
        name: ApplicationConfig.name,
        isResolved: true,
        instance: this.container.applicationConfig,
        host: this,
      }),
    );
  }

  public addInjectable<T extends Injectable>(
    injectable: Provider,
    host?: Type<T>,
  ) {
    if (this.isCustomProvider(injectable)) {
      return this.addCustomProvider(injectable, this._injectables);
    }
    const instanceWrapper = new InstanceWrapper({
      name: injectable.name,
      metatype: injectable,
      instance: null,
      isResolved: false,
      scope: this.getClassScope(injectable),
      host: this,
    });
    this._injectables.set(injectable.name, instanceWrapper);

    if (host) {
      const hostWrapper = this._controllers.get(host && host.name);
      hostWrapper && hostWrapper.addEnhancerMetadata(instanceWrapper);
    }
  }

  public addProvider(provider: Provider): string {
    if (this.isCustomProvider(provider)) {
      return this.addCustomProvider(provider, this._providers);
    }
    this._providers.set(
      (provider as Type<Injectable>).name,
      new InstanceWrapper({
        name: (provider as Type<Injectable>).name,
        metatype: provider as Type<Injectable>,
        instance: null,
        isResolved: false,
        scope: this.getClassScope(provider),
        host: this,
      }),
    );
    return (provider as Type<Injectable>).name;
  }

  public isCustomProvider(
    provider: Provider,
  ): provider is
    | ClassProvider
    | FactoryProvider
    | ValueProvider
    | ExistingProvider {
    return !isNil(
      (provider as
        | ClassProvider
        | FactoryProvider
        | ValueProvider
        | ExistingProvider).provide,
    );
  }

  public addCustomProvider(
    provider: CustomProvider,
    collection: Map<string, any>,
  ): string {
    const name = this.getProviderStaticToken(provider.provide) as string;

    provider = {
      ...provider,
      name,
    };

    this.checkForMixedMulti(provider, collection);

    if (this.isMultiProvider(provider)) {
      // The provider which was added by the user needs to be renamed, because the
      // the multi provider would override that token
      provider.name = this.addMultiProvider(provider, collection);
    }

    if (this.isCustomClass(provider)) {
      this.addCustomClass(provider, collection);
    } else if (this.isCustomValue(provider)) {
      this.addCustomValue(provider, collection);
    } else if (this.isCustomFactory(provider)) {
      this.addCustomFactory(provider, collection);
    } else if (this.isCustomUseExisting(provider)) {
      this.addCustomUseExisting(provider, collection);
    }
    return name;
  }

  public isCustomClass(provider: any): provider is ClassProvider {
    return !isUndefined((provider as ClassProvider).useClass);
  }

  public isCustomValue(provider: any): provider is ValueProvider {
    return !isUndefined((provider as ValueProvider).useValue);
  }

  public isCustomFactory(provider: any): provider is FactoryProvider {
    return !isUndefined((provider as FactoryProvider).useFactory);
  }

  public isCustomUseExisting(provider: any): provider is ExistingProvider {
    return !isUndefined((provider as ExistingProvider).useExisting);
  }

  public isMultiProvider(provider: any): provider is MultiProvider {
    return provider.multi === true;
  }

  public isDynamicModule(exported: any): exported is DynamicModule {
    return exported && exported.module;
  }

  public addCustomClass(
    provider: ClassProvider & ProviderName,
    collection: Map<string, InstanceWrapper>,
  ) {
    const { name, useClass, scope, multi } = provider;
    collection.set(
      name as string,
      new InstanceWrapper({
        name,
        metatype: useClass,
        instance: null,
        isResolved: false,
        scope,
        multi,
        host: this,
      }),
    );
  }

  public addCustomValue(
    provider: ValueProvider & ProviderName,
    collection: Map<string, InstanceWrapper>,
  ) {
    const { name, useValue: value, multi } = provider;
    collection.set(
      name as string,
      new InstanceWrapper({
        name,
        metatype: null,
        instance: value,
        isResolved: true,
        async: value instanceof Promise,
        host: this,
        multi,
      }),
    );
  }

  public addCustomFactory(
    provider: FactoryProvider & ProviderName,
    collection: Map<string, InstanceWrapper>,
  ) {
    const { name, useFactory: factory, inject, scope, multi } = provider;
    collection.set(
      name as string,
      new InstanceWrapper({
        name,
        metatype: factory as any,
        instance: null,
        isResolved: false,
        inject: inject || [],
        scope,
        multi,
        host: this,
      }),
    );
  }

  public addCustomUseExisting(
    provider: ExistingProvider & ProviderName,
    collection: Map<string, InstanceWrapper>,
  ) {
    const { name, useExisting } = provider;
    collection.set(
      name as string,
      new InstanceWrapper({
        name,
        metatype: (instance => instance) as any,
        instance: null,
        isResolved: false,
        inject: [useExisting],
        host: this,
      }),
    );
  }

  /**
   * Checks if the already stored provider has the same `multi` value
   * as the new provider.
   *
   * @param provider The provider which should get newly added
   * @param collection The collection with providers
   *
   * @throws {MixedMultiProviderException}
   * If the `multi` option of the stored provider differs from the given provider
   */
  private checkForMixedMulti(
    provider: CustomProvider,
    collection: Map<string, InstanceWrapper>,
  ) {
    // Get provider which is already stored in the collection.
    const storedProvider = collection.get(provider.provide as any);
    if (storedProvider) {
      // Multiple provider use the same key.
      const isMultiDefined = !(
        isUndefined((provider as any).multi) &&
        isUndefined(storedProvider.multi)
      );
      // Check if the new provider has the same multi value
      if (
        isMultiDefined &&
        (provider as any).multi !== !!storedProvider.multi
      ) {
        // It has mixed multi option
        throw new MixedMultiProviderException(provider.name);
      }
    }
  }

  /**
   * Adds two new providers which will act as a multi providers.
   *
   * - Module-Internal Multi Provider:
   * provides: `${provider.provide}`
   * factory: returns all the values of the same token inside the module as an array.
   * In addition it also returns all the values of the module-external multi providers
   * of the same token and concats it to the array.
   *
   * - Module-External Multi Provider
   * provides: `MULTI_EXTERNAL_${module.id}_${provider.provide}`
   * factory: returns the value of the module-internal multi provider
   *
   * @returns {any}
   * The new token which should be used for the given provider,
   * because the new created multi provider will be using the
   * token of the given provider.
   *
   * @param provider The provider which is a multi provider
   * @param collection The collection to add the multi provider to
   */
  public addMultiProvider(
    provider: MultiProvider,
    collection: Map<string, InstanceWrapper>,
  ): string {
    const { multi } = provider;
    const multiProviderToken = provider.provide;

    // Get provider which is already stored in the collection.
    const storedProvider = collection.get(provider.provide as any);

    // The stored provided which are being exported by another module
    // with the same token
    const storedExportedProviders = [...this.relatedModules]
      .filter(module =>
        module.exports.has(getMultiExternalToken(module, multiProviderToken)),
      )
      .map(module => getMultiExternalToken(module, multiProviderToken));

    const elementToken: string = `${MULTI_ELEMENT_PREFIX}_${randomStringGenerator()}`;
    let inject: any[] = null;

    // If the provider indicates that it's a multi-provider, process it specially.
    // First check whether it's been defined already.
    if (storedProvider) {
      // A provider already exists. Append new value
      inject = [...(storedProvider.inject || []), elementToken];
    } else {
      // First multi provider with this token
      inject = [elementToken];
    }

    if (storedExportedProviders.length) {
      const providersToAdd = storedExportedProviders.filter(
        exportedProvider => !inject.includes(exportedProvider),
      );
      inject = [...providersToAdd, ...inject];
    }

    collection.set(
      multiProviderToken as any,
      // The new multi provider
      new InstanceWrapper({
        name: multiProviderToken,
        // Returns all the inject arguments as array
        metatype: MULTI_PROVIDER_FACTORY(storedExportedProviders.length),
        inject,
        multi,
        host: this,
      }),
    );

    collection.set(
      getMultiExternalToken(this, multiProviderToken),
      new InstanceWrapper({
        name: getMultiExternalToken(this, multiProviderToken),
        metatype: args => args,
        inject: [multiProviderToken],
        multi,
        host: this,
      }),
    );
    return elementToken;
  }

  public addExportedProvider(
    provider: Provider & ProviderName | string | symbol | DynamicModule,
  ) {
    const addExportedUnit = (token: string | symbol) =>
      this.validateExportedProvider(token).forEach(exportingToken =>
        this._exports.add(exportingToken),
      );

    if (this.isCustomProvider(provider as any)) {
      return this.addCustomExportedProvider(provider as any);
    } else if (isString(provider) || isSymbol(provider)) {
      return addExportedUnit(provider);
    } else if (this.isDynamicModule(provider)) {
      const { module } = provider;
      return addExportedUnit(module.name);
    }
    addExportedUnit(provider.name);
  }

  public addCustomExportedProvider(
    provider:
      | FactoryProvider
      | ValueProvider
      | ClassProvider
      | ExistingProvider,
  ) {
    const provide = provider.provide;
    if (isString(provide) || isSymbol(provide)) {
      return this.validateExportedProvider(provide).forEach(token =>
        this._exports.add(token),
      );
    }
    this.validateExportedProvider(provide.name).forEach(token =>
      this._exports.add(token),
    );
  }

  public validateExportedProvider(token: string | symbol) {
    const provider = this._providers.get(token);
    if (provider) {
      if (provider.multi) {
        return [token, getMultiExternalToken(provider.host, token)];
      }
      return [token];
    }

    const importsArray = [...this._imports.values()];
    const importsNames = importsArray
      .filter(item => item)
      .map(({ metatype }) => metatype)
      .filter(metatype => metatype)
      .map(({ name }) => name);

    if (!importsNames.includes(token as any)) {
      const { name } = this.metatype;
      throw new UnknownExportException(name);
    }
    return [token];
  }

  public addController(controller: Type<Controller>) {
    this._controllers.set(
      controller.name,
      new InstanceWrapper({
        name: controller.name,
        metatype: controller,
        instance: null,
        isResolved: false,
        scope: this.getClassScope(controller),
        host: this,
      }),
    );
  }

  public addRelatedModule(module: Module) {
    this._imports.add(module);
    module.distance =
      this._distance + 1 > module._distance
        ? this._distance + 1
        : module._distance;
  }

  public replace(toReplace: string | symbol | Type<any>, options: any) {
    if (options.isProvider && this.hasProvider(toReplace)) {
      const name = this.getProviderStaticToken(toReplace);
      const originalProvider = this._providers.get(name);
      return originalProvider.mergeWith({ provide: toReplace, ...options });
    } else if (!options.isProvider && this.hasInjectable(toReplace)) {
      const name = this.getProviderStaticToken(toReplace);
      const originalInjectable = this._injectables.get(name);
      return originalInjectable.mergeWith({
        provide: toReplace,
        ...options,
      });
    }
  }

  public hasProvider(token: string | symbol | Type<any>): boolean {
    const name = this.getProviderStaticToken(token);
    return this._providers.has(name);
  }

  public hasInjectable(token: string | symbol | Type<any>): boolean {
    const name = this.getProviderStaticToken(token);
    return this._injectables.has(name);
  }

  public getProviderStaticToken(
    provider: string | symbol | Type<any> | Abstract<any>,
  ): string | symbol {
    return isFunction(provider)
      ? (provider as Function).name
      : (provider as string | symbol);
  }

  public getProviderByKey<T = any>(name: string | symbol): InstanceWrapper<T> {
    return this._providers.get(name) as InstanceWrapper<T>;
  }

  public createModuleReferenceType(): any {
    const self = this;
    return class extends ModuleRef {
      constructor() {
        super(self.container);
      }

      public get<TInput = any, TResult = TInput>(
        typeOrToken: Type<TInput> | string | symbol,
        options: { strict: boolean } = { strict: true },
      ): TResult {
        if (!(options && options.strict)) {
          return this.find<TInput, TResult>(typeOrToken);
        }
        return this.findInstanceByToken<TInput, TResult>(typeOrToken, self);
      }

      public resolve<TInput = any, TResult = TInput>(
        typeOrToken: Type<TInput> | string | symbol,
        contextId = createContextId(),
        options: { strict: boolean } = { strict: true },
      ): Promise<TResult> {
        return this.resolvePerContext(typeOrToken, self, contextId, options);
      }

      public async create<T = any>(type: Type<T>): Promise<T> {
        if (!(type && isFunction(type) && type.prototype)) {
          throw new InvalidClassException(type);
        }
        return this.instantiateClass<T>(type, self);
      }
    };
  }

  private getClassScope(provider: Provider): Scope {
    const metadata = Reflect.getMetadata(SCOPE_OPTIONS_METADATA, provider);
    return metadata && metadata.scope;
  }
}
