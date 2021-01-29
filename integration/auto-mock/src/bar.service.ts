import { Injectable } from '@nestjs/common';
import { FooService } from './foo.service';

@Injectable()
export class BarService {

  constructor(private readonly foo: FooService) {}

  bar() {
    this.foo.foo();
  }
}