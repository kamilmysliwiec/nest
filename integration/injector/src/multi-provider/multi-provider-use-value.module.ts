
import { Module } from '@nestjs/common';

@Module({
  providers: [{
    provide: 'TEST',
    useValue: 'a',
    multi: true,
  },
  {
    provide: 'TEST',
    useValue: 'b',
    multi: true,
  }],
})
export class MultiProviderUseValueModule { }