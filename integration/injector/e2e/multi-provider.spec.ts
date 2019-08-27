import { Test } from '@nestjs/testing';
import { expect } from 'chai';
import { MultiProviderUseValueModule } from '../src/multi-provider/multi-provider-use-value.module';
import { MultiProviderUseFactoryModule } from '../src/multi-provider/multi-provider-use-factory.module';
import { MultiProviderUseClassModule } from '../src/multi-provider/multi-provider-use-class.module';
import { MultiProviderMixedModule } from '../src/multi-provider/multi-provider-mixed.module';
import { MutliProviderExportModule } from '../src/multi-provider/multi-provider-export.module';
import { MixedMultiProviderException } from '@nestjs/core/errors/exceptions/mixed-multi-provider.exception';
import { MultiProviderCircularModule } from '../src/multi-provider/multi-provider-circular.module';

describe('MultiProvider', () => {
  it(`should return an array of values when using the "multi" option and "useValue"`, async () => {
    const builder = Test.createTestingModule({
      imports: [MultiProviderUseValueModule],
    });
    const app = await builder.compile();
    expect(app.get('TEST')).to.deep.eq(['a', 'b']);
  });

  it(`should return an array of values when using the "multi" option and "useFactory"`, async () => {
    const builder = Test.createTestingModule({
      imports: [MultiProviderUseFactoryModule],
    });
    const app = await builder.compile();
    expect(app.get('TEST')).to.deep.eq(['a', 'b']);
  });

  it(`should return an array of values when using the "multi" option and "useClass"`, async () => {
    const builder = Test.createTestingModule({
      imports: [MultiProviderUseClassModule],
    });
    const app = await builder.compile();
    expect(app.get('TEST')[0].test()).to.deep.eq('a');
    expect(app.get('TEST')[1].test()).to.deep.eq('b');
  });

  it(`should return an array of values when using the "multi" option with exported providers`, async () => {
    const builder = Test.createTestingModule({
      imports: [MutliProviderExportModule],
    });
    const app = await builder.compile();
    expect(app.get('TEST')).to.deep.eq(['a', 'b', 'c']);
  });

  it(`should return an array of values when using the "multi" option with exported providers in a circual module`, async () => {
    const builder = Test.createTestingModule({
      imports: [MultiProviderCircularModule],
    });
    const app = await builder.compile();
    expect(app.get('TEST')).to.deep.eq(['b', 'a']);
  });

  it(`should throw an error if "mutli" value is mixed with the same token`, async () => {
    try {
      const builder = Test.createTestingModule({
        imports: [MultiProviderMixedModule],
      });
      await builder.compile();
    } catch (err) {
      expect(err).to.be.instanceof(MixedMultiProviderException);
    }
  });
});