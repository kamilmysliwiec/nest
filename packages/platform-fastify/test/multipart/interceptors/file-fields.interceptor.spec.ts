import { expect } from 'chai';
import { of } from 'rxjs';
import * as sinon from 'sinon';
import { CallHandler } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { FileFieldsInterceptor } from '../../../multipart/interceptors/file-fields.interceptor';
import { UploadField } from '../../../multipart/interfaces';

describe('FileFieldsInterceptor', () => {
  const uploadFields: UploadField[] = [{ name: 'field', maxCount: 10 }];
  it('should return metatype with expected structure', async () => {
    const targetClass = FileFieldsInterceptor(uploadFields);
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
    it('should call fileFields() with expected params', async () => {
      const target = new (FileFieldsInterceptor(uploadFields))();
      const callback = () => {};
      const arraySpy = sinon
        .stub((target as any).multipart, 'fileFields')
        .returns(callback);

      await target.intercept(context, handler);

      expect(arraySpy.called).to.be.true;
      expect(arraySpy.calledWith()).to.be.true;
    });
    it('should transform exception', async () => {
      const target = new (FileFieldsInterceptor(uploadFields))();
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
