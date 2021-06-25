import {
  Body,
  Controller,
  createParamDecorator,
  ExecutionContext,
  Headers,
  Param,
  Put,
  Get,
  Delete,
  Req,
  Post,
  Type,
  Query,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { expect } from 'chai';

describe('Http Testing Handlers', () => {
  let testingModule: TestingModule;

  const compileTestingModuleWithController = (controllerClass: Type<any>) => {
    return Test.createTestingModule({
      controllers: [controllerClass],
    }).compile();
  };

  describe('With a simple HTTP controller', () => {
    @Controller('dogs')
    class DogsController {
      @Get()
      fetchAllDogs() {
        return ['Dogo', 'Doge', 'Dogg'];
      }
    }

    beforeEach(async () => {
      testingModule = await compileTestingModuleWithController(DogsController);
    });

    afterEach(() => testingModule.close());

    it('creates an executable handler for the given HTTP controller class and method', async () => {
      const request = { params: { name: 'Dogo' }, body: { age: 10 } };
      const handler = testingModule
        .createHttpHandler({
          class: DogsController,
          methodName: 'fetchAllDogs',
        })
        .setRequest(request);

      const result = await handler.run();

      expect(result).to.eql(['Dogo', 'Doge', 'Dogg']);
    });
  });

  describe('With a custom Request', () => {
    @Controller('dogs')
    class DogsController {
      @Put(':name')
      update(
        @Param('name') name: string,
        @Body('age') age: number,
        @Headers() headers: Record<string, string>,
      ) {
        if (headers && headers.Authorization) {
          return { name, age, chipId: '1234567' };
        }

        return { name, age };
      }
    }

    beforeEach(async () => {
      testingModule = await compileTestingModuleWithController(DogsController);
    });

    afterEach(() => testingModule.close());

    it('allows configuring request', async () => {
      const request = {
        params: { name: 'Doggo' },
        body: { age: 9 },
        headers: { Authorization: 'AccessKey K0tL3t' },
      };
      const handler = testingModule.createHttpHandler({
        class: DogsController,
        methodName: 'update',
      });

      const result = await handler.setRequest(request).run();

      expect(result).to.eql({ name: 'Doggo', age: 9, chipId: '1234567' });
    });
  });

  describe('With custom Param Decorators', () => {
    const CurrentUser = createParamDecorator(
      (data: unknown, ctx: ExecutionContext) => {
        const req = ctx.switchToHttp().getRequest();
        return req.user;
      },
    );
    @Controller('tasks')
    class TasksController {
      @Delete()
      deleteTasks(@CurrentUser() user: { userId: string }) {
        return { userId: user.userId, deleteCount: 16 };
      }
    }

    beforeEach(async () => {
      testingModule = await compileTestingModuleWithController(TasksController);
    });

    afterEach(() => testingModule.close());

    it('allows using custom param decorators', async () => {
      const request = {
        params: { name: 'Doggy' },
        user: { userId: '2d2301c6-5e4d-4257-97e0-ec59005c77c8' },
      };
      const handler = testingModule.createHttpHandler({
        class: TasksController,
        methodName: 'deleteTasks',
      });

      const result = await handler.setRequest(request).run();

      expect(result).to.eql({
        userId: '2d2301c6-5e4d-4257-97e0-ec59005c77c8',
        deleteCount: 16,
      });
    });
  });

  describe('With the Request being injected', () => {
    @Controller('tasks')
    class BlogController {
      @Post()
      addArticle(@Req() req: any) {
        return req.body.title;
      }
    }

    beforeEach(async () => {
      testingModule = await compileTestingModuleWithController(BlogController);
    });

    afterEach(() => testingModule.close());

    it('allows request to be injected using decorator @Req', async () => {
      const request = {
        body: {
          title: 'NestJS',
          description:
            'How to do proper Integration testing of your HTTP controllers',
        },
      };
      const handler = testingModule.createHttpHandler({
        class: BlogController,
        methodName: 'addArticle',
      });

      const result = await handler.setRequest(request).run();

      expect(result).to.eql('NestJS');
    });
  });

  describe('With Pipes', () => {
    describe('In route handler parameter decorators', () => {
      @Controller('cats')
      class CatsController {
        private readonly catsIdToName = new Map([
          [1, 'kitteh'],
          [2, 'kitten'],
          [3, 'kitty'],
        ]);

        @Get(':id')
        retrieveCatById(@Param('id', new ParseIntPipe()) id: number) {
          return { id, name: this.catsIdToName.get(id) };
        }

        @Get()
        retrieveFirstCat(
          @Query('reverseName', ParseBoolPipe) reverseName: boolean,
        ) {
          const id = 1;
          const name = this.catsIdToName.get(id);
          return {
            id,
            name:
              reverseName === true ? name.split('').reverse().join('') : name,
          };
        }
      }

      beforeEach(async () => {
        testingModule = await compileTestingModuleWithController(
          CatsController,
        );
      });

      afterEach(() => testingModule.close());

      it('executes Pipes passed as instances in @Param', async () => {
        const handler = testingModule.createHttpHandler({
          class: CatsController,
          methodName: 'retrieveCatById',
        });

        const result = await handler.setRequest({ params: { id: '2' } }).run();

        expect(result).to.eql({ id: 2, name: 'kitten' });
      });

      it('executes Pipes passed as classes in @Query', async () => {
        const handler = testingModule.createHttpHandler({
          class: CatsController,
          methodName: 'retrieveFirstCat',
        });

        const result = await handler
          .setRequest({ query: { reverseName: 'true' } })
          .run();

        expect(result).to.eql({ id: 1, name: 'hettik' });
      });
    });
  });
});
