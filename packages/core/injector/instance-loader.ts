import { Logger } from '@nestjs/common';
import { Controller } from '@nestjs/common/interfaces/controllers/controller.interface';
import { Injectable } from '@nestjs/common/interfaces/injectable.interface';
import { MODULE_INIT_MESSAGE } from '../helpers/messages';
import { NestContainer } from './container';
import { Injector } from './injector';
import { InternalCoreModule } from './internal-core-module';
import { Module } from './module';

export class InstanceLoader {
  protected readonly injector = new Injector();
  private readonly logger = new Logger(InstanceLoader.name, true);

  constructor(private readonly container: NestContainer) {}

  public async createInstancesOfDependencies() {
    const modules = this.container.getModules();

    this.createPrototypes(modules);
    await this.createInstances(modules);
  }

  private createPrototypes(modules: Map<string, Module>) {
    modules.forEach(module => {
      this.createPrototypesOfProviders(module);
      this.createPrototypesOfInjectables(module);
      this.createPrototypesOfControllers(module);
    });
  }

  private async createInstances(modules: Map<string, Module>) {
    await Promise.all(
      [...modules.values()].map(async module => {
        await this.createInstancesOfProviders(module);
        await this.createInstancesOfInjectables(module);
        await this.createInstancesOfControllers(module);

        const { name } = module.metatype;
        this.isModuleWhitelisted(name) &&
          this.logger.log(MODULE_INIT_MESSAGE`${name}`);
      }),
    );
  }

  private createPrototypesOfProviders(module: Module) {
    const { providers } = module;
    providers.forEach(wrapper =>
      this.injector.loadPrototype<Injectable>(wrapper, providers),
    );
  }

  private async createInstancesOfProviders(module: Module) {
    const { providers } = module;
    const wrappers = [...providers.values()];
    await Promise.all(
      wrappers.map(item => this.injector.loadProvider(item, module)),
    );
  }

  private createPrototypesOfControllers(module: Module) {
    const { controllers } = module;
    controllers.forEach(wrapper =>
      this.injector.loadPrototype<Controller>(wrapper, controllers),
    );
  }

  private async createInstancesOfControllers(module: Module) {
    const { controllers } = module;
    const wrappers = [...controllers.values()];
    await Promise.all(
      wrappers.map(item => this.injector.loadController(item, module)),
    );
  }

  private createPrototypesOfInjectables(module: Module) {
    const { injectables } = module;
    injectables.forEach(wrapper =>
      this.injector.loadPrototype(wrapper, injectables),
    );
  }

  private async createInstancesOfInjectables(module: Module) {
    const { injectables } = module;
    const wrappers = [...injectables.values()];
    await Promise.all(
      wrappers.map(item => this.injector.loadInjectable(item, module)),
    );
  }

  private isModuleWhitelisted(name: string): boolean {
    return name !== InternalCoreModule.name;
  }
}
