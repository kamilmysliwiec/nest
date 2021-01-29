import { Injectable } from '@nestjs/common';

@Injectable()
export class FooService {
  foo() {
    console.log('foo called');
  }
}
