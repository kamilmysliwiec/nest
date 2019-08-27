import { Module, Inject } from '@nestjs/common';

class Test1 {
  test() {
    return 'a';
  }
}
class Test2 {
  constructor(@Inject('B_VALUE') private b: string) { }
  test() {
    return this.b;
  }
}

@Module({
  providers: [
    {
      provide: 'B_VALUE',
      useValue: 'b',
    },
    {
      provide: 'TEST',
      useClass: Test1,
      multi: true,
    },
    {
      provide: 'TEST',
      useClass: Test2,
      multi: true,
    }],
})
export class MultiProviderUseClassModule { }