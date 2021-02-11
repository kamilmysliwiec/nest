import { NestContainer } from '@nestjs/core';
import { InstanceLoader } from '@nestjs/core/injector/instance-loader';
import { TestingInjector } from './testing-injector';

export class TestingInstanceLoader extends InstanceLoader {
  protected injector = new TestingInjector();

  async createInstancesOfDependencies(
    container?: NestContainer,
    mocker?: () => any,
  ): Promise<void> {
    this.injector.setContainer(container);
    mocker && this.injector.setMocker(mocker);
    await super.createInstancesOfDependencies();
  }
}
