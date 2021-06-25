import { Type } from '@nestjs/common';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsResponse,
} from '@nestjs/websockets';
import { Test, TestingModule } from '@nestjs/testing';
import { expect } from 'chai';
import { Socket } from 'socket.io';

describe('WebSockets Testing Handlers', () => {
  let testingModule: TestingModule;

  const compileTestingModuleWithController = (controllerClass: Type<any>) => {
    return Test.createTestingModule({
      controllers: [controllerClass],
    }).compile();
  };

  describe('With a simple WebSockets gateway', () => {
    @WebSocketGateway()
    class EventsGateway {
      @SubscribeMessage('identity')
      async identity(client: Socket, data: string): Promise<string> {
        return data;
      }
    }

    beforeEach(async () => {
      testingModule = await compileTestingModuleWithController(EventsGateway);
    });

    afterEach(() => testingModule.close());

    it('creates an executable handler for the given WS gateway class and method', async () => {
      const handler = testingModule.createWsHandler({
        class: EventsGateway,
        methodName: 'identity',
      });

      const result = await handler.setData('Hello World').run();

      expect(result).to.equal('Hello World');
    });
  });

  describe('With a custom client', () => {
    @WebSocketGateway()
    class EventsGateway {
      @SubscribeMessage('identity')
      async reverseIdentity(client: any, data: string): Promise<string> {
        return client.reverseString(data);
      }
    }

    beforeEach(async () => {
      testingModule = await compileTestingModuleWithController(EventsGateway);
    });

    afterEach(() => testingModule.close());

    it('allows configuring the (socket) client passed to the handler', async () => {
      const handler = testingModule.createWsHandler({
        class: EventsGateway,
        methodName: 'reverseIdentity',
      });
      const data = 'dlroW olleH';
      const client = {
        reverseString: (input: string) => input.split('').reverse().join(''),
      };
      const result = await handler.setClient(client).setData(data).run();

      expect(result).to.equal('Hello World');
    });
  });

  describe('With an injected message body', () => {
    @WebSocketGateway()
    class EventsGateway {
      @SubscribeMessage('user-registered')
      async userRegistered(
        @MessageBody() data: string,
      ): Promise<WsResponse<string>> {
        return { data, event: 'user-registered' };
      }
    }

    beforeEach(async () => {
      testingModule = await compileTestingModuleWithController(EventsGateway);
    });

    afterEach(() => testingModule.close());

    it('allows message body to be injected using decorator @MessageBody', async () => {
      const handler = testingModule.createWsHandler({
        class: EventsGateway,
        methodName: 'userRegistered',
      });

      const result = await handler.setData('Hello World').run();

      expect(result).to.eql({
        data: 'Hello World',
        event: 'user-registered',
      });
    });
  });
});
