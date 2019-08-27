import { Module, forwardRef } from '@nestjs/common';

const MULTI_TOKEN = 'TEST';

@Module({
  imports: [forwardRef(() => MultiProviderCircularModule)],
  providers: [
    {
      provide: MULTI_TOKEN,
      multi: true,
      useValue: 'a',
    },
  ],
  exports: [MULTI_TOKEN],
})
class AModule {}

@Module({
  imports: [forwardRef(() => AModule)],
  providers: [
    {
      provide: MULTI_TOKEN,
      useValue: 'b',
      multi: true,
    },
  ],
  exports: [MULTI_TOKEN],
})
export class MultiProviderCircularModule {}
