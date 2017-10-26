import { WsException } from '@nestjs/websockets';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { PipeTransform, Pipe, ArgumentMetadata, HttpStatus } from '';

@Pipe()
export class ValidationPipe implements PipeTransform<any> {
    async transform(value, metadata: ArgumentMetadata) {
      const { metatype } = metadata;
      if (!metatype || !this.toValidate(metatype)) {
          return value;
      }
      const object = plainToClass(metatype, value);
      const errors = await validate(object);
      if (errors.length > 0) {
          throw new WsException('Validation failed');
      }
      return value;
    }

    private toValidate(metatype): boolean {
      const types = [String, Boolean, Number, Array, Object];
      return !types.find((type) => metatype === type);
    }
}
