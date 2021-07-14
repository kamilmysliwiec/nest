import { expect } from 'chai';
import { of } from 'rxjs';
import * as sinon from 'sinon';
import { CallHandler } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { FileInterceptor } from '../../../multipart/interceptors/file.interceptor';

describe('FileInterceptor', () => {
  it('should return metatype with expected structure', async () => {
    const targetClass = FileInterceptor('file');
    expect(targetClass.prototype.intercept).to.not.be.undefined;
  });
  describe('intercept', () => {
    let handler: CallHandler;
    const context = new ExecutionContextHost([]);
    const fieldName = 'file';
    beforeEach(() => {
      handler = {
        handle: () => of('test'),
      };
      context.switchToHttp = () =>
        ({
          getRequest: () => {
            return {
              file: () => () => {},
            };
          },
        } as any);
    });
    it('should call file() with expected params', async () => {
      const target = new (FileInterceptor(fieldName))();
      const callback = () => {};
      const filesSpy = sinon
        .stub((target as any).multipart, 'file')
        .returns(callback);
      await target.intercept(context as any, handler);

      expect(filesSpy.called).to.be.true;
      expect(filesSpy.calledWith(fieldName)).to.be.true;
    });
    it('should transform exception', async () => {
      const fieldName = 'file';
      const target = new (FileInterceptor(fieldName))();
      const callback = () => {};
      (target as any).multipart = {
        file: () => callback,
      };
      (target.intercept(context, handler) as any).catch(
        error => expect(error).to.not.be.undefined,
      );
    });
  });
});
