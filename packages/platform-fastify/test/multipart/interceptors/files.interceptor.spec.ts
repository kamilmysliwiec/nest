import { expect } from 'chai';
import { of } from 'rxjs';
import * as sinon from 'sinon';
import { CallHandler } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { FilesInterceptor } from '../../../multipart/interceptors/files.interceptor';

describe('FilesInterceptor', () => {
  it('should return metatype with expected structure', async () => {
    const targetClass = FilesInterceptor('files');
    expect(targetClass.prototype.intercept).to.not.be.undefined;
  });
  describe('intercept', () => {
    let handler: CallHandler;
    const context = new ExecutionContextHost([]);
    const fieldName = 'files';
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
    it('should call files() with expected params', async () => {
      const maxCount = 10;
      const target = new (FilesInterceptor(fieldName, maxCount))();
      const callback = () => {};
      const filesSpy = sinon
        .stub((target as any).multipart, 'files')
        .returns(callback);
      await target.intercept(context, handler);
      expect(filesSpy.called).to.be.true;
      expect(filesSpy.calledWith(fieldName, maxCount)).to.be.true;
    });
    it('should transform exception', async () => {
      const fieldName = 'file';
      const target = new (FilesInterceptor(fieldName))();
      const callback = () => {};
      (target as any).multipart = {
        files: () => callback,
      };
      (target.intercept(new ExecutionContextHost([]), handler) as any).catch(
        error => expect(error).to.not.be.undefined,
      );
    });
  });
});
