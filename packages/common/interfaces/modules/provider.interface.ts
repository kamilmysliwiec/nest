import { Abstract } from '../abstract.interface';
import { Scope } from '../scope-options.interface';
import { Type } from '../type.interface';

/**
 *
 * @publicApi
 */
export type Provider<T = any> =
  | Type<any>
  | ClassProvider<T>
  | ValueProvider<T>
  | FactoryProvider<T>
  | ExistingProvider<T>;

/**
 * Interface defining a *Class* type provider.
 *
 * For example:
 * ```typescript
 * const configServiceProvider = {
 * provide: ConfigService,
 * useClass:
 *   process.env.NODE_ENV === 'development'
 *     ? DevelopmentConfigService
 *     : ProductionConfigService,
 * };
 * ```
 *
 * @see [Use class](https://docs.nestjs.com/fundamentals/custom-providers#use-class)
 * @see [Injection scopes](https://docs.nestjs.com/fundamentals/injection-scopes)
 *
 * @publicApi
 */
export interface ClassProvider<T = any> {
  /**
   * Injection token
   */
  provide: string | symbol | Type<any> | Abstract<any> | Function;
  /**
   * Type (class name) of provider (instance to be injected).
   */
  useClass: Type<T>;
  /**
   * Optional enum defining lifetime of the provider that is injected.
   */
  scope?: Scope;
  /**
   * If true, then injector returns an array of instances. This is useful to allow multiple
   * providers spread across many files to provide configuration information to a common token.
   */
  multi?: boolean | undefined;
}

/**
 * Interface defining a *Value* type provider.
 *
 * For example:
 * ```typescript
 * const connectionProvider = {
 *   provide: 'CONNECTION',
 *   useValue: connection,
 * };
 * ```
 *
 * @see [Use value](https://docs.nestjs.com/fundamentals/custom-providers#use-value)
 *
 * @publicApi
 */
export interface ValueProvider<T = any> {
  /**
   * Injection token
   */
  provide: string | symbol | Type<any> | Abstract<any> | Function;
  /**
   * Instance of a provider to be injected.
   */
  useValue: T;
  /**
   * If true, then injector returns an array of instances. This is useful to allow multiple
   * providers spread across many files to provide configuration information to a common token.
   */
  multi?: boolean | undefined;
}

/**
 * Interface defining a *Factory* type provider.
 *
 * For example:
 * ```typescript
 * const connectionFactory = {
 *   provide: 'CONNECTION',
 *   useFactory: (optionsProvider: OptionsProvider) => {
 *     const options = optionsProvider.get();
 *     return new DatabaseConnection(options);
 *   },
 *   inject: [OptionsProvider],
 * };
 * ```
 *
 * @see [Use factory](https://docs.nestjs.com/fundamentals/custom-providers#use-factory)
 * @see [Injection scopes](https://docs.nestjs.com/fundamentals/injection-scopes)
 *
 * @publicApi
 */
export interface FactoryProvider<T = any> {
  /**
   * Injection token
   */
  provide: string | symbol | Type<any> | Abstract<any> | Function;
  /**
   * Factory function that returns an instance of the provider to be injected.
   */
  useFactory: (...args: any[]) => T;
  /**
   * Optional list of providers to be injected into the context of the Factory function.
   */
  inject?: Array<Type<any> | string | symbol | Abstract<any> | Function>;
  /**
   * Optional enum defining lifetime of the provider that is returned by the Factory function.
   */
  scope?: Scope;
  /**
   * If true, then injector returns an array of instances. This is useful to allow multiple
   * providers spread across many files to provide configuration information to a common token.
   */
  multi?: boolean | undefined;
}

/**
 * Interface defining an *Existing* (aliased) type provider.
 *
 * For example:
 * ```typescript
 * const loggerAliasProvider = {
 *   provide: 'AliasedLoggerService',
 *   useExisting: LoggerService
 * };
 * ```
 *
 * @see [Use existing](https://docs.nestjs.com/fundamentals/custom-providers#use-existing)
 *
 * @publicApi
 */
export interface ExistingProvider<T = any> {
  /**
   * Injection token
   */
  provide: string | symbol | Type<any> | Abstract<any> | Function;
  /**
   * Provider to be aliased by the Injection token.
   */
  useExisting: any;
}
