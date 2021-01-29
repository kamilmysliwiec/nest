import { Logger, LoggerService, Module } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common/interfaces';
import { ApplicationConfig } from '@nestjs/core/application-config';
import { NestContainer } from '@nestjs/core/injector/container';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { DependenciesScanner } from '@nestjs/core/scanner';
import { OverrideBy, OverrideByFactoryOptions } from './interfaces';
import { TestingLogger } from './services/testing-logger.service';
import { TestingInstanceLoader } from './testing-instance-loader';
import { TestingModule } from './testing-module';

export class TestingModuleBuilder {
  private readonly applicationConfig = new ApplicationConfig();
  private readonly container = new NestContainer(this.applicationConfig);
  private readonly overloadsMap = new Map();
  private readonly scanner: DependenciesScanner;
  private readonly instanceLoader = new TestingInstanceLoader(this.container);
  private readonly module: any;
  private testingLogger: LoggerService;
  private mocker?: () => any;

  constructor(metadataScanner: MetadataScanner, metadata: ModuleMetadata) {
    this.scanner = new DependenciesScanner(
      this.container,
      metadataScanner,
      this.applicationConfig,
    );
    this.module = this.createModule(metadata);
  }

  public setLogger(testingLogger: LoggerService) {
    this.testingLogger = testingLogger;
    return this;
  }

  public overridePipe<T = any>(typeOrToken: T): OverrideBy {
    return this.override(typeOrToken, false);
  }

  public useMocker(mocker: () => any): TestingModuleBuilder {
    this.mocker = mocker;
    return this;
  }

  public overrideFilter<T = any>(typeOrToken: T): OverrideBy {
    return this.override(typeOrToken, false);
  }

  public overrideGuard<T = any>(typeOrToken: T): OverrideBy {
    return this.override(typeOrToken, false);
  }

  public overrideInterceptor<T = any>(typeOrToken: T): OverrideBy {
    return this.override(typeOrToken, false);
  }

  public overrideProvider<T = any>(typeOrToken: T): OverrideBy {
    return this.override(typeOrToken, true);
  }

  public async compile(): Promise<TestingModule> {
    this.applyLogger();
    await this.scanner.scan(this.module);

    this.applyOverloadsMap();
    await this.instanceLoader.createInstancesOfDependencies(this.mocker);
    this.scanner.applyApplicationProviders();

    const root = this.getRootModule();
    return new TestingModule(this.container, [], root, this.applicationConfig);
  }

  private override<T = any>(typeOrToken: T, isProvider: boolean): OverrideBy {
    const addOverload = (options: any) => {
      this.overloadsMap.set(typeOrToken, {
        ...options,
        isProvider,
      });
      return this;
    };
    return this.createOverrideByBuilder(addOverload);
  }

  private createOverrideByBuilder(
    add: (provider: any) => TestingModuleBuilder,
  ): OverrideBy {
    return {
      useValue: value => add({ useValue: value }),
      useFactory: (options: OverrideByFactoryOptions) =>
        add({ ...options, useFactory: options.factory }),
      useClass: metatype => add({ useClass: metatype }),
    };
  }

  private applyOverloadsMap() {
    [...this.overloadsMap.entries()].forEach(([item, options]) => {
      this.container.replace(item, options);
    });
  }

  private getRootModule() {
    const modules = this.container.getModules().values();
    return modules.next().value;
  }

  private createModule(metadata: ModuleMetadata) {
    class RootTestModule {}
    Module(metadata)(RootTestModule);
    return RootTestModule;
  }

  private applyLogger() {
    Logger.overrideLogger(this.testingLogger || new TestingLogger());
  }
}
