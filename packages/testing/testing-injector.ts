import {
  Injector,
  InjectorDependencyContext,
} from '@nestjs/core/injector/injector';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Module } from '@nestjs/core/injector/module';
import { STATIC_CONTEXT } from '@nestjs/core/injector/constants';
import { Scope } from '@nestjs/common';

export class TestingInjector extends Injector {
  private mocker?: <T extends any = {}>() => T;
  setMocker(mocker: () => any): void {
    this.mocker = mocker;
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
        const newWrapper = new InstanceWrapper({
          name,
          isAlias: false,
          scope: wrapper.scope,
          instance: this.mocker<T>(),
          isResolved: true,
        });
        return newWrapper;
      } else {
        throw err;
      }
    }
  }
}
