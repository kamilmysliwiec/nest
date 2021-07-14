import { expect } from 'chai';
import { of } from 'rxjs';
import * as sinon from 'sinon';
import { CallHandler } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { AnyFilesInterceptor } from '../../../multipart/interceptors/any-files.interceptor';

describe('AnyFilesInterceptor', () => {
  it('should return metatype with expected structure', async () => {
    const targetClass = AnyFilesInterceptor();
    expect(targetClass.prototype.intercept).to.not.be.undefined;
  });
  describe('intercept', () => {
    let handler: CallHandler;
    const context = new ExecutionContextHost([]);
    beforeEach(() => {
      handler = {
        handle: () => of('test'),
      };
      context.switchToHttp = () =>
        ({
          getRequest: () => {
            return {
              file: () => () => {},
              files: () => () => {},
            };
          },
        } as any);
    });
    it('should call any() with expected params', async () => {
      const target = new (AnyFilesInterceptor())();
      const callback = () => {};
      const arraySpy = sinon
        .stub((target as any).multipart, 'any')
        .returns(callback);

      await target.intercept(context, handler);

      expect(arraySpy.called).to.be.true;
      expect(arraySpy.calledWith()).to.be.true;
    });
    it('should transform exception', async () => {
      const target = new (AnyFilesInterceptor())();
      const callback = () => {};
      (target as any).multipart = {
        any: () => callback,
      };
      (target.intercept(context, handler) as any).catch(
        error => expect(error).to.not.be.undefined,
      );
    });
  });
});
