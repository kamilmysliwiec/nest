import { InstanceLoader } from '@nestjs/core/injector/instance-loader';
import { TestingInjector } from './testing-injector';

export class TestingInstanceLoader extends InstanceLoader {
  protected injector = new TestingInjector();

  async createInstancesOfDependencies(mocker?: () => any): Promise<void> {
    mocker && this.injector.setMocker(mocker);
    await super.createInstancesOfDependencies();
  }
}
