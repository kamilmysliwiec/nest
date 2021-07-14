import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  NotAcceptableException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { expect } from 'chai';
import { multipartExceptions } from '../../../multipart/multipart/multipart.constants';
import { transformException } from '../../../multipart/multipart/multipart.utils';

describe('transformException', () => {
  describe('if error does not exist', () => {
    it('behave as identity', () => {
      const err = undefined;
      expect(transformException(err)).to.be.eq(err);
    });
  });
  describe('if error is instance of HttpException', () => {
    it('behave as identity', () => {
      const err = new HttpException('response', 500);
      expect(transformException(err)).to.be.eq(err);
    });
  });
  describe('if error exists and is not instance of HttpException', () => {
    describe('should return "NotAcceptableException"', () => {
      it('if is FST_INVALID_MULTIPART_CONTENT_TYPE exception', () => {
        const err = {
          message: multipartExceptions.FST_INVALID_MULTIPART_CONTENT_TYPE,
        };
        expect(transformException(err as any)).to.be.instanceof(
          NotAcceptableException,
        );
      });
    });
    describe('should return "PayloadTooLargeException"', () => {
      it('if is FST_PARTS_LIMIT exception', () => {
        const err = { message: multipartExceptions.FST_PARTS_LIMIT };
        expect(transformException(err as any)).to.be.instanceof(
          PayloadTooLargeException,
        );
      });
      it('if is FST_FILES_LIMIT exception', () => {
        const err = { message: multipartExceptions.FST_FILES_LIMIT };
        expect(transformException(err as any)).to.be.instanceof(
          PayloadTooLargeException,
        );
      });
      it('if is FST_FIELDS_LIMIT exception', () => {
        const err = { message: multipartExceptions.FST_FIELDS_LIMIT };
        expect(transformException(err as any)).to.be.instanceof(
          PayloadTooLargeException,
        );
      });
      it('if is FST_REQ_FILE_TOO_LARGE exception', () => {
        const err = { message: multipartExceptions.FST_REQ_FILE_TOO_LARGE };
        expect(transformException(err as any)).to.be.instanceof(
          PayloadTooLargeException,
        );
      });
    });
    describe('should return "BadRequestException"', () => {
      it('if is FST_PROTO_VIOLATION exception', () => {
        const err = { message: multipartExceptions.FST_PROTO_VIOLATION };
        expect(transformException(err as any)).to.be.instanceof(
          BadRequestException,
        );
      });
      it('if is LIMIT_UNEXPECTED_FILE exception', () => {
        const err = { message: multipartExceptions.LIMIT_UNEXPECTED_FILE };
        expect(transformException(err as any)).to.be.instanceof(
          BadRequestException,
        );
      });
    });
  });
  describe('if error exists and is not fastify-multipart exception', () => {
    it('should return "InternalServerErrorException"', () => {
      expect(
        transformException(new Error('Internal server exception test')),
      ).to.be.instanceof(InternalServerErrorException);
    });
  });
});
