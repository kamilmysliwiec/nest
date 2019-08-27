import { Module } from '@nestjs/common';

const MULTI_TOKEN = 'TEST';
const INTERNAL_PROVIDER_TOKEN = 'INTERNAL_PROVIDER_TOKEN';

@Module({
  providers: [
    {
      provide: INTERNAL_PROVIDER_TOKEN,
      useValue: 'a',
    },
    {
      provide: MULTI_TOKEN,
      multi: true,
      useFactory: arg => arg,
      inject: [INTERNAL_PROVIDER_TOKEN],
    },
  ],
  exports: [MULTI_TOKEN],
})
class AModule {}

@Module({
  imports: [AModule],
  providers: [
    {
      provide: MULTI_TOKEN,
      useValue: 'b',
      multi: true,
    },
    {
      provide: MULTI_TOKEN,
      useValue: 'c',
      multi: true,
    },
  ],
})
export class MutliProviderExportModule {}
