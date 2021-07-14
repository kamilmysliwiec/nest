import { expect } from 'chai';
import * as sinon from 'sinon';
import { MULTIPART_MODULE_OPTIONS } from '../../../multipart/files.constants';
import { MultipartModule } from '../../../multipart/multipart.module';

describe('MultipartModule', () => {
  describe('register', () => {
    it('should provide an options', () => {
      const options = {
        test: 'test',
      };
      const dynamicModule = MultipartModule.register(options as any);

      expect(dynamicModule.providers).to.have.length(2);
      expect(dynamicModule.imports).to.be.undefined;
      expect(dynamicModule.exports).to.include(MULTIPART_MODULE_OPTIONS);
      expect(dynamicModule.providers).to.deep.include({
        provide: MULTIPART_MODULE_OPTIONS,
        useValue: options,
      });
    });
  });

  describe('register async', () => {
    describe('when useFactory', () => {
      it('should provide an options', () => {
        const options: any = {};
        const asyncOptions = {
          useFactory: () => options,
        };
        const dynamicModule = MultipartModule.registerAsync(asyncOptions);

        expect(dynamicModule.providers).to.have.length(2);
        expect(dynamicModule.imports).to.be.undefined;
        expect(dynamicModule.exports).to.include(MULTIPART_MODULE_OPTIONS);
        expect(dynamicModule.providers).to.deep.include({
          provide: MULTIPART_MODULE_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: [],
        });
      });
    });

    describe('when useExisting', () => {
      it('should provide an options', () => {
        const asyncOptions = {
          useExisting: Object,
        };
        const dynamicModule = MultipartModule.registerAsync(
          asyncOptions as any,
        );

        expect(dynamicModule.providers).to.have.length(2);
        expect(dynamicModule.imports).to.be.undefined;
        expect(dynamicModule.exports).to.include(MULTIPART_MODULE_OPTIONS);
      });
    });

    describe('when useClass', () => {
      it('should provide an options', () => {
        const asyncOptions = {
          useClass: Object,
        };
        const dynamicModule = MultipartModule.registerAsync(
          asyncOptions as any,
        );

        expect(dynamicModule.providers).to.have.length(3);
        expect(dynamicModule.imports).to.be.undefined;
        expect(dynamicModule.exports).to.include(MULTIPART_MODULE_OPTIONS);
      });
      it('provider should call "createMultipartOptions"', async () => {
        const asyncOptions = {
          useClass: Object,
        };
        const dynamicModule = MultipartModule.registerAsync(
          asyncOptions as any,
        );
        const optionsFactory = {
          createMultipartOptions: sinon.spy(),
        };
        await ((dynamicModule.providers[0] as any).useFactory as any)(
          optionsFactory,
        );
        expect(optionsFactory.createMultipartOptions.called).to.be.true;
      });
    });
  });
});
