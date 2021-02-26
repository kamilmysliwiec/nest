import {
  Injector,
  InjectorDependencyContext,
} from '@nestjs/core/injector/injector';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Module } from '@nestjs/core/injector/module';
import { STATIC_CONTEXT } from '@nestjs/core/injector/constants';
import { NestContainer } from '@nestjs/core';
import { MockFactory } from './interfaces';

export class TestingInjector extends Injector {
  protected mocker?: MockFactory;

  protected container: NestContainer;
  setMocker(mocker: MockFactory): void {
    this.mocker = mocker;
  }

  setContainer(container: NestContainer) {
    this.container = container;
  }

  async resolveComponentInstance<T>(
    moduleRef: Module,
    name: any,
    dependencyContext: InjectorDependencyContext,
    wrapper: InstanceWrapper<T>,
    contextId = STATIC_CONTEXT,
    inquirer?: InstanceWrapper,
    keyOrIndex?: string | number,
  ): Promise<InstanceWrapper> {
    try {
      const retWrapper = await super.resolveComponentInstance(
        moduleRef,
        name,
        dependencyContext,
        wrapper,
        contextId,
        inquirer,
        keyOrIndex,
      );
      return retWrapper;
    } catch (err) {
      if (this.mocker) {
        const mockedInstance = this.mocker(name);
        if (!mockedInstance) {
          throw err;
        }
        const newWrapper = new InstanceWrapper({
          name,
          isAlias: false,
          scope: wrapper.scope,
          instance: mockedInstance,
          isResolved: true,
          host: moduleRef,
          metatype: wrapper.metatype,
        });
        const internalCoreModule = this.container.getInternalCoreModuleRef() as any;
        internalCoreModule._providers.set(name, newWrapper);
        internalCoreModule._exports.add(name);
        return newWrapper;
      } else {
        throw err;
      }
    }
  }
}
