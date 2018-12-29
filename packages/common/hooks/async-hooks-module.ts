import { Global, Module } from '@nestjs/common';
import { AsyncContext } from './async-context';

@Global()
@Module({
  providers: [
    {
      provide: AsyncContext,
      useValue: AsyncContext.getInstance(),
    },
  ],
  exports: [AsyncContext],
})
export class AsyncHooksModule {}
