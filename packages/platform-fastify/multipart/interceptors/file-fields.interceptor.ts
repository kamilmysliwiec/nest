import {
  CallHandler,
  ExecutionContext,
  Inject,
  mixin,
  NestInterceptor,
  Optional,
  Type,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { MULTIPART_MODULE_OPTIONS } from '../files.constants';
import {
  MultipartOptions,
  UploadField,
} from '../interfaces/multipart-options.interface';
import { MultipartWrapper, transformException } from '../multipart';

export const FileFieldsInterceptor = (
  uploadFields: UploadField[],
  localOptions?: MultipartOptions,
): Type<NestInterceptor> => {
  class MixinInterceptor implements NestInterceptor {
    protected multipart: MultipartWrapper;

    public constructor(
      @Optional()
      @Inject(MULTIPART_MODULE_OPTIONS)
      options: MultipartOptions = {},
    ) {
      this.multipart = new MultipartWrapper({
        ...options,
        ...localOptions,
      });
    }

    public async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<any>> {
      const req = context.switchToHttp().getRequest();
      const fieldname = 'files';
      try {
        req[fieldname] = await this.multipart.fileFields(uploadFields)(req);
      } catch (err) {
        throw transformException(err);
      }
      return next.handle();
    }
  }

  const Interceptor = mixin(MixinInterceptor);
  return Interceptor as Type<NestInterceptor>;
};
