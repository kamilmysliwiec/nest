import { Controller, Type } from '@nestjs/common';
import { MessagePattern, Ctx, Payload } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { expect } from 'chai';

describe('RPC Testing Handlers', () => {
  let testingModule: TestingModule;

  const compileTestingModuleWithController = (controllerClass: Type<any>) => {
    return Test.createTestingModule({
      controllers: [controllerClass],
    }).compile();
  };

  describe('With a simple RPC controller', () => {
    @Controller()
    class MathController {
      @MessagePattern({ cmd: 'sum' })
      accumulate(data: number[]): number {
        return (data || []).reduce((a, b) => a + b, 0);
      }
    }

    beforeEach(async () => {
      testingModule = await compileTestingModuleWithController(MathController);
    });

    afterEach(() => testingModule.close());

    it('creates an executable handler for the given RPC controller class and method', async () => {
      const handler = testingModule.createRpcHandler({
        class: MathController,
        methodName: 'accumulate',
      });

      const result = await handler.run();

      expect(result).to.equal(0);
    });
  });

  describe('With a custom context', () => {
    @Controller()
    class MathController {
      @MessagePattern({ cmd: 'sum' })
      accumulate(data: number[], context: any): number {
        return (data || []).reduce((a, b) => a + b, context.offset);
      }
    }

    beforeEach(async () => {
      testingModule = await compileTestingModuleWithController(MathController);
    });

    afterEach(() => testingModule.close());

    it('allows configuring the data and context passed to the handler', async () => {
      const handler = testingModule.createRpcHandler({
        class: MathController,
        methodName: 'accumulate',
      });
      const data = [1, 2, 3];
      const context = { offset: 10 };
      const result = await handler.setData(data).setContext(context).run();

      expect(result).to.equal(16);
    });
  });

  describe('With injected Payload and Context', () => {
    it('allows context to be injected using decorator @Ctx', () => {
      @Controller()
      class MathController {
        @MessagePattern({ cmd: 'sum' })
        accumulate(@Ctx() context: any, data: number[]): number {
          return (data || []).reduce((a, b) => a + b, context.offset);
        }
      }

      beforeEach(async () => {
        testingModule = await compileTestingModuleWithController(
          MathController,
        );
      });

      afterEach(() => testingModule.close());

      it('allows configuring the data and context passed to the handler', async () => {
        const handler = testingModule.createRpcHandler({
          class: MathController,
          methodName: 'accumulate',
        });
        const data = [1, 2, 3];
        const context = { offset: 30 };
        const result = await handler.setData(data).setContext(context).run();

        expect(result).to.equal(36);
      });
    });

    it('allows payload to be injected using decorator @Payload', () => {
      @Controller()
      class MathController {
        @MessagePattern({ cmd: 'sum' })
        accumulate(_: string, @Payload() data: number[]): number {
          return (data || []).reduce((a, b) => a + b);
        }
      }

      beforeEach(async () => {
        testingModule = await compileTestingModuleWithController(
          MathController,
        );
      });

      afterEach(() => testingModule.close());

      it('allows configuring the data and context passed to the handler', async () => {
        const handler = testingModule.createRpcHandler({
          class: MathController,
          methodName: 'accumulate',
        });
        const data = [1, 2, 3, 4, 5];
        const result = await handler.setData(data).run();

        expect(result).to.equal(15);
      });
    });

    it('handles both @Payload and @Ctx', () => {
      @Controller()
      class MathController {
        @MessagePattern({ cmd: 'sum' })
        accumulate(@Payload() data: number[], @Ctx() context: any): number {
          return (data || []).reduce((a, b) => a + b, context.offset);
        }
      }

      beforeEach(async () => {
        testingModule = await compileTestingModuleWithController(
          MathController,
        );
      });

      afterEach(() => testingModule.close());

      it('allows configuring the data and context passed to the handler', async () => {
        const handler = testingModule.createRpcHandler({
          class: MathController,
          methodName: 'accumulate',
        });
        const data = [1, 2, 3, 4, 5];
        const context = { offset: 30 };
        const result = await handler.setData(data).setContext(context).run();

        expect(result).to.equal(45);
      });
    });
  });
});
