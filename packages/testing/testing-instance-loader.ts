import { NestContainer } from '@nestjs/core';
import { InstanceLoader } from '@nestjs/core/injector/instance-loader';
import { MockFactory } from './interfaces';
import { TestingInjector } from './testing-injector';

export class TestingInstanceLoader extends InstanceLoader {
  protected injector = new TestingInjector();

  async createInstancesOfDependencies(
    container?: NestContainer,
    mocker?: MockFactory,
  ): Promise<void> {
    this.injector.setContainer(container);
    mocker && this.injector.setMocker(mocker);
    await super.createInstancesOfDependencies();
  }
}
