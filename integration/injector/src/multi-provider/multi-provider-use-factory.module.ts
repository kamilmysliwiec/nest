import { Module } from '@nestjs/common';

const BProviderToken = 'BProvider';

@Module({
  providers: [{
    provide: 'TEST',
    useFactory: () => 'a',
    multi: true,
  },
  {
    provide: BProviderToken,
    useValue: 'b',
  },
  {
    provide: 'TEST',
    useFactory: (b: string) => b,
    inject: [BProviderToken],
    multi: true,
  }],
})
export class MultiProviderUseFactoryModule { }