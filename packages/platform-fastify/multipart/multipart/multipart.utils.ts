import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  NotAcceptableException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { multipartExceptions } from './multipart.constants';

export function transformException(err: Error | undefined) {
  if (!err || err instanceof HttpException) {
    return err;
  }
  switch (err.message) {
    case multipartExceptions.FST_PARTS_LIMIT:
    case multipartExceptions.FST_FILES_LIMIT:
    case multipartExceptions.FST_FIELDS_LIMIT:
    case multipartExceptions.FST_REQ_FILE_TOO_LARGE:
      return new PayloadTooLargeException(err.message);
    case multipartExceptions.FST_INVALID_MULTIPART_CONTENT_TYPE:
      return new NotAcceptableException(err.message);
    case multipartExceptions.FST_PROTO_VIOLATION:
    case multipartExceptions.LIMIT_UNEXPECTED_FILE:
      return new BadRequestException(err.message);
  }
  if (err instanceof Error) {
    return new InternalServerErrorException(err.message);
  }
  return err;
}
