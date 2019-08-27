import { Module, Inject } from '@nestjs/common';

@Module({
  providers: [

    {
      provide: 'TEST',
      useValue: 'a',
      multi: true,
    },
    {
      provide: 'TEST',
      useValue: 'b',
      multi: false,
    }],
})
export class MultiProviderMixedModule { }