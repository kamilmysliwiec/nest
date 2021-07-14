import { expect } from 'chai';
import * as sinon from 'sinon';
import { NO_MESSAGE_HANDLER } from '../../constants';
import { BaseRpcContext } from '../../ctx-host/base-rpc.context';
import { ServerRMQ } from '../../server/server-rmq';

describe('ServerRMQ', () => {
  let server: ServerRMQ;

  const objectToMap = obj =>
    new Map(Object.keys(obj).map(key => [key, obj[key]]) as any);

  beforeEach(() => {
    server = new ServerRMQ({});
  });
  describe('listen', () => {
    let createClient: sinon.SinonStub;
    let onStub: sinon.SinonStub;
    let createChannelStub: sinon.SinonStub;
    let setupChannelStub: sinon.SinonStub;
    let client: any;
    let callbackSpy: sinon.SinonSpy;

    beforeEach(() => {
      onStub = sinon
        .stub()
        .callsFake((event, callback) => event === 'connect' && callback());
      createChannelStub = sinon.stub().callsFake(({ setup }) => setup());
      setupChannelStub = sinon
        .stub(server, 'setupChannel')
        .callsFake(() => ({} as any));

      client = {
        on: onStub,
        createChannel: createChannelStub,
      };
      createClient = sinon.stub(server, 'createClient').callsFake(() => client);
      callbackSpy = sinon.spy();
    });
    afterEach(() => {
      setupChannelStub.restore();
    });
    it('should call "createClient"', () => {
      server.listen(callbackSpy);
      expect(createClient.called).to.be.true;
    });
    it('should bind "connect" event to handler', () => {
      server.listen(callbackSpy);
      expect(onStub.getCall(0).args[0]).to.be.equal('connect');
    });
    it('should bind "disconnect" event to handler', () => {
      server.listen(callbackSpy);
      expect(onStub.getCall(1).args[0]).to.be.equal('disconnect');
    });
    describe('when "start" throws an exception', () => {
      it('should call callback with a thrown error as an argument', () => {
        const error = new Error('random error');

        sinon.stub(server, 'start').callsFake(() => {
          throw error;
        });
        server.listen(callbackSpy);
        expect(callbackSpy.calledWith(error)).to.be.true;
      });
    });
  });
  describe('close', () => {
    const rmqServer = { close: sinon.spy() };
    const rmqChannel = { close: sinon.spy() };

    beforeEach(() => {
      (server as any).server = rmqServer;
      (server as any).channel = rmqChannel;
    });
    it('should close server', () => {
      server.close();
      expect(rmqServer.close.called).to.be.true;
    });
    it('should close channel', () => {
      server.close();
      expect(rmqChannel.close.called).to.be.true;
    });
  });

  describe('handleMessage', () => {
    const createMessage = payload => ({
      content: {
        toString: () => JSON.stringify(payload),
      },
      properties: { correlationId: 1 },
    });
    const pattern = 'test';
    const msg = createMessage({
      pattern,
      data: 'tests',
      id: '3',
    });
    let sendMessageStub: sinon.SinonStub;

    beforeEach(() => {
      sendMessageStub = sinon.stub(server, 'sendMessage').callsFake(() => ({}));
    });
    it('should call "handleEvent" if identifier is not present', async () => {
      const handleEventSpy = sinon.spy(server, 'handleEvent');
      await server.handleMessage(createMessage({ pattern: '', data: '' }), '');
      expect(handleEventSpy.called).to.be.true;
    });
    it('should send NO_MESSAGE_HANDLER error if key does not exists in handlers object', async () => {
      await server.handleMessage(msg, '');
      expect(
        sendMessageStub.calledWith({
          id: '3',
          status: 'error',
          err: NO_MESSAGE_HANDLER,
        }),
      ).to.be.true;
    });
    it('should call handler if exists in handlers object', async () => {
      const handler = sinon.spy();
      (server as any).messageHandlers = objectToMap({
        [pattern]: handler as any,
      });
      await server.handleMessage(msg, '');
      expect(handler.calledOnce).to.be.true;
    });
  });
  describe('setupChannel', () => {
    const queue = 'test';
    const queueOptions = {};
    const isGlobalPrefetchCount = true;
    const prefetchCount = 10;

    let channel: any = {};

    beforeEach(() => {
      (server as any)['queue'] = queue;
      (server as any)['queueOptions'] = queueOptions;
      (server as any)['isGlobalPrefetchCount'] = isGlobalPrefetchCount;
      (server as any)['prefetchCount'] = prefetchCount;

      channel = {
        assertQueue: sinon.spy(() => ({})),
        prefetch: sinon.spy(),
        consume: sinon.spy(),
      };
    });
    it('should call "assertQueue" with queue and queue options', async () => {
      await server.setupChannel(channel, () => null);
      expect(channel.assertQueue.calledWith(queue, queueOptions)).to.be.true;
    });
    it('should call "prefetch" with prefetchCount and "isGlobalPrefetchCount"', async () => {
      await server.setupChannel(channel, () => null);
      expect(channel.prefetch.calledWith(prefetchCount, isGlobalPrefetchCount))
        .to.be.true;
    });
    it('should call "consumeChannel" method', async () => {
      await server.setupChannel(channel, () => null);
      expect(channel.consume.called).to.be.true;
    });
    it('should call "resolve" function', async () => {
      const resolve = sinon.spy();
      await server.setupChannel(channel, resolve);
      expect(resolve.called).to.be.true;
    });
  });

  describe('sendMessage', () => {
    let channel: any;

    beforeEach(() => {
      channel = {
        sendToQueue: sinon.spy(),
      };
      server['channel'] = channel;
    });

    it('should publish message to indicated queue', () => {
      const message = { test: true };
      const replyTo = 'test';
      const correlationId = '0';

      server.sendMessage(message, replyTo, correlationId);
      expect(
        channel.sendToQueue.calledWith(
          replyTo,
          Buffer.from(JSON.stringify(message)),
          { correlationId },
        ),
      ).to.be.true;
    });
  });

  describe('handleEvent', () => {
    const channel = 'test';
    const data = 'test';

    it('should call handler with expected arguments', () => {
      const handler = sinon.spy();
      (server as any).messageHandlers = objectToMap({
        [channel]: handler,
      });

      server.handleEvent(
        channel,
        { pattern: '', data },
        new BaseRpcContext([]),
      );
      expect(handler.calledWith(data)).to.be.true;
    });
  });
});
