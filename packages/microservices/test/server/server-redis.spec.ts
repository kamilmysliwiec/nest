import { expect } from 'chai';
import * as sinon from 'sinon';
import { NO_MESSAGE_HANDLER } from '../../constants';
import { BaseRpcContext } from '../../ctx-host/base-rpc.context';
import { ServerRedis } from '../../server/server-redis';

describe('ServerRedis', () => {
  let server: ServerRedis;

  const objectToMap = obj =>
    new Map(Object.keys(obj).map(key => [key, obj[key]]) as any);

  beforeEach(() => {
    server = new ServerRedis({});
  });
  describe('listen', () => {
    let onSpy: sinon.SinonSpy;
    let client: any;
    let callbackSpy: sinon.SinonSpy;

    beforeEach(() => {
      onSpy = sinon.spy();
      client = {
        on: onSpy,
      };
      sinon.stub(server, 'createRedisClient').callsFake(() => client);

      callbackSpy = sinon.spy();
    });
    it('should bind "error" event to handler', () => {
      server.listen(callbackSpy);
      expect(onSpy.getCall(0).args[0]).to.be.equal('error');
    });
    it('should bind "connect" event to handler', () => {
      server.listen(callbackSpy);
      expect(onSpy.getCall(3).args[0]).to.be.equal('connect');
    });
    it('should bind "message" event to handler', () => {
      server.listen(callbackSpy);
      expect(onSpy.getCall(2).args[0]).to.be.equal('message');
    });
    describe('when "start" throws an exception', () => {
      it('should call callback with a thrown error as an argument', () => {
        const error = new Error('random error');

        const callbackSpy = sinon.spy();
        sinon.stub(server, 'start').callsFake(() => {
          throw error;
        });
        server.listen(callbackSpy);
        expect(callbackSpy.calledWith(error)).to.be.true;
      });
    });
  });
  describe('close', () => {
    const pub = { quit: sinon.spy() };
    const sub = { quit: sinon.spy() };
    beforeEach(() => {
      (server as any).pubClient = pub;
      (server as any).subClient = sub;
    });
    it('should close pub & sub server', () => {
      server.close();

      expect(pub.quit.called).to.be.true;
      expect(sub.quit.called).to.be.true;
    });
  });
  describe('handleConnection', () => {
    let onSpy: sinon.SinonSpy, subscribeSpy: sinon.SinonSpy, sub;

    beforeEach(() => {
      onSpy = sinon.spy();
      subscribeSpy = sinon.spy();
      sub = {
        on: onSpy,
        subscribe: subscribeSpy,
      };
    });
    it('should bind "message" event to handler', () => {
      server.bindEvents(sub, null);
      expect(onSpy.getCall(0).args[0]).to.be.equal('message');
    });
    it('should subscribe to each pattern', () => {
      const pattern = 'test';
      const handler = sinon.spy();
      (server as any).messageHandlers = objectToMap({
        [pattern]: handler,
      });
      server.bindEvents(sub, null);
      expect(subscribeSpy.calledWith(pattern)).to.be.true;
    });
  });
  describe('getMessageHandler', () => {
    it(`should return function`, () => {
      expect(typeof server.getMessageHandler(null)).to.be.eql('function');
    });
  });
  describe('handleMessage', () => {
    let getPublisherSpy: sinon.SinonSpy;

    const channel = 'test';
    const data = 'test';
    const id = '3';

    beforeEach(() => {
      getPublisherSpy = sinon.spy();
      sinon.stub(server, 'getPublisher').callsFake(() => getPublisherSpy);
    });
    it('should call "handleEvent" if identifier is not present', async () => {
      const handleEventSpy = sinon.spy(server, 'handleEvent');
      sinon.stub(server, 'parseMessage').callsFake(() => ({ data } as any));

      await server.handleMessage(channel, JSON.stringify({}), null);
      expect(handleEventSpy.called).to.be.true;
    });
    it(`should publish NO_MESSAGE_HANDLER if pattern not exists in messageHandlers object`, async () => {
      sinon.stub(server, 'parseMessage').callsFake(() => ({ id, data } as any));
      await server.handleMessage(channel, JSON.stringify({ id }), null);
      expect(
        getPublisherSpy.calledWith({
          id,
          status: 'error',
          err: NO_MESSAGE_HANDLER,
        }),
      ).to.be.true;
    });
    it(`should call handler with expected arguments`, async () => {
      const handler = sinon.spy();
      (server as any).messageHandlers = objectToMap({
        [channel]: handler,
      });
      sinon.stub(server, 'parseMessage').callsFake(() => ({ id, data } as any));

      await server.handleMessage(channel, {}, null);
      expect(handler.calledWith(data)).to.be.true;
    });
  });
  describe('getPublisher', () => {
    let publisherSpy: sinon.SinonSpy;
    let pub, publisher;

    const id = '1';
    const pattern = 'test';

    beforeEach(() => {
      publisherSpy = sinon.spy();
      pub = {
        publish: publisherSpy,
      };
      publisher = server.getPublisher(pub, pattern, id);
    });
    it(`should return function`, () => {
      expect(typeof server.getPublisher(null, null, id)).to.be.eql('function');
    });
    it(`should call "publish" with expected arguments`, () => {
      const respond = 'test';
      publisher({ respond, id });
      expect(
        publisherSpy.calledWith(
          `${pattern}.reply`,
          JSON.stringify({ respond, id }),
        ),
      ).to.be.true;
    });
  });
  describe('parseMessage', () => {
    it(`should return parsed json`, () => {
      const obj = { test: 'test' };
      expect(server.parseMessage(obj)).to.deep.equal(
        JSON.parse(JSON.stringify(obj)),
      );
    });
    it(`should not parse argument if it is not an object`, () => {
      const content = 'test';
      expect(server.parseMessage(content)).to.equal(content);
    });
  });
  describe('getRequestPattern', () => {
    const test = 'test';
    it(`should leave pattern as it is`, () => {
      const expectedResult = test;
      expect(server.getRequestPattern(test)).to.equal(expectedResult);
    });
  });
  describe('getReplyPattern', () => {
    const test = 'test';
    it(`should append ".reply" to string`, () => {
      const expectedResult = test + '.reply';
      expect(server.getReplyPattern(test)).to.equal(expectedResult);
    });
  });
  describe('getClientOptions', () => {
    it('should return options object with "retry_strategy" and call "createRetryStrategy"', () => {
      const createSpy = sinon.spy(server, 'createRetryStrategy');
      const { retry_strategy } = server.getClientOptions();
      try {
        retry_strategy({} as any);
      } catch {}
      expect(createSpy.called).to.be.true;
    });
  });
  describe('createRetryStrategy', () => {
    describe('when is terminated', () => {
      it('should return undefined', () => {
        (server as any).isExplicitlyTerminated = true;
        const result = server.createRetryStrategy({} as any);
        expect(result).to.be.undefined;
      });
    });
    describe('when "retryAttempts" does not exist', () => {
      it('should throw an exception', () => {
        (server as any).options.options = {};
        (server as any).options.options.retryAttempts = undefined;

        expect(() => server.createRetryStrategy({} as any)).to.throw(Error);
      });
    });
    describe('when "attempts" count is max', () => {
      it('should throw an exception', () => {
        (server as any).options.options = {};
        (server as any).options.options.retryAttempts = 3;

        expect(() =>
          server.createRetryStrategy({ attempt: 4 } as any),
        ).to.throw(Error);
      });
    });
    describe('when ECONNREFUSED', () => {
      it('should call logger', () => {
        const loggerErrorSpy = sinon.spy((server as any).logger, 'error');
        try {
          server.createRetryStrategy({
            error: { code: 'ECONNREFUSED' },
          } as any);
        } catch {}
        expect(loggerErrorSpy.called).to.be.true;
      });
    });
    describe('otherwise', () => {
      it('should return delay (ms)', () => {
        (server as any).options = {};
        (server as any).isExplicitlyTerminated = false;
        (server as any).options.retryAttempts = 3;
        (server as any).options.retryDelay = 3;
        const result = server.createRetryStrategy({ attempt: 2 } as any);
        expect(result).to.be.eql((server as any).options.retryDelay);
      });
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
