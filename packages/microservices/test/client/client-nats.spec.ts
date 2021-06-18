import { expect } from 'chai';
import * as sinon from 'sinon';
import { ClientNats } from '../../client/client-nats';
import { ERROR_EVENT } from '../../constants';

describe('ClientNats', () => {
  const client = new ClientNats({});

  describe('publish', () => {
    const pattern = 'test';
    const msg = { pattern, data: 'data' };
    const id = 3;
    const subscriptionId = 10;

    let subscribeSpy: sinon.SinonSpy,
      publishSpy: sinon.SinonSpy,
      onSpy: sinon.SinonSpy,
      removeListenerSpy: sinon.SinonSpy,
      requestSpy: sinon.SinonSpy,
      unsubscribeSpy: sinon.SinonSpy,
      connectSpy: sinon.SinonStub,
      natsClient,
      createClient: sinon.SinonStub;

    beforeEach(() => {
      subscribeSpy = sinon.spy(() => subscriptionId);
      publishSpy = sinon.spy();
      onSpy = sinon.spy();
      removeListenerSpy = sinon.spy();
      unsubscribeSpy = sinon.spy();
      requestSpy = sinon.spy(() => subscriptionId);

      natsClient = {
        subscribe: subscribeSpy,
        on: (type, handler) => (type === 'subscribe' ? handler() : onSpy()),
        removeListener: removeListenerSpy,
        unsubscribe: unsubscribeSpy,
        addListener: () => ({}),
        publish: publishSpy,
        request: requestSpy,
      };
      (client as any).natsClient = natsClient;

      connectSpy = sinon.stub(client, 'connect').callsFake(async () => {
        (client as any).natsClient = natsClient;
      });
      createClient = sinon
        .stub(client, 'createClient')
        .callsFake(() => client as any);
    });
    afterEach(() => {
      connectSpy.restore();
      createClient.restore();
    });
    it('should publish stringified message to pattern name', async () => {
      await client['publish'](msg, () => {});
      expect(requestSpy.getCall(0).args[0]).to.be.eql(pattern);
    });
    describe('on error', () => {
      let assignPacketIdStub: sinon.SinonStub;
      beforeEach(() => {
        assignPacketIdStub = sinon
          .stub(client, 'assignPacketId' as any)
          .callsFake(() => {
            throw new Error();
          });
      });
      afterEach(() => {
        assignPacketIdStub.restore();
      });

      it('should call callback', () => {
        const callback = sinon.spy();
        client['publish'](msg, callback);

        expect(callback.called).to.be.true;
        expect(callback.getCall(0).args[0].err).to.be.instanceof(Error);
      });
    });
    describe('dispose callback', () => {
      let assignStub: sinon.SinonStub;
      let callback: sinon.SinonSpy, subscription;

      beforeEach(async () => {
        callback = sinon.spy();
        assignStub = sinon
          .stub(client, 'assignPacketId' as any)
          .callsFake(packet => Object.assign(packet, { id }));

        subscription = await client['publish'](msg, callback);
        subscription();
      });
      afterEach(() => {
        assignStub.restore();
      });

      it('should unsubscribe', () => {
        expect(unsubscribeSpy.calledWith(subscriptionId)).to.be.true;
      });
    });
  });
  describe('createSubscriptionHandler', () => {
    const pattern = 'test';
    const msg = { pattern, data: 'data', id: '1' };
    let callback: sinon.SinonSpy, subscription;
    const responseMessage = {
      response: 'test',
      id: '1',
    };
    const errorResponseMessage = {
      response: new Error('Nats error'),
      id: '1',
    };
    const consumerErrorMessage = {
      err: new Error('Consumer error'),
      id: '1',
    };

    describe('not completed', () => {
      beforeEach(async () => {
        callback = sinon.spy();

        subscription = client.createSubscriptionHandler(msg, callback);
        subscription(responseMessage);
      });
      it('should call callback with expected arguments', () => {
        expect(
          callback.calledWith({
            err: undefined,
            response: responseMessage.response,
          }),
        ).to.be.true;
      });
    });
    describe('disposed and "id" is correct', () => {
      beforeEach(async () => {
        callback = sinon.spy();
        subscription = client.createSubscriptionHandler(msg, callback);
        subscription({
          ...responseMessage,
          isDisposed: true,
        });
      });

      it('should call callback with dispose param', () => {
        expect(callback.called).to.be.true;
        expect(
          callback.calledWith({
            isDisposed: true,
            response: responseMessage.response,
            err: undefined,
          }),
        ).to.be.true;
      });
    });
    describe('disposed and "id" is incorrect', () => {
      beforeEach(async () => {
        callback = sinon.spy();
        subscription = client.createSubscriptionHandler(
          {
            ...msg,
            id: '2',
          },
          callback,
        );
        subscription(responseMessage);
      });

      it('should not call callback', () => {
        expect(callback.called).to.be.false;
      });
    });
    describe('error response propogation', () => {
      beforeEach(async () => {
        callback = sinon.spy();
        subscription = client.createSubscriptionHandler(
          msg,
          callback,
        );
        subscription(errorResponseMessage);
      });
      it('should call callback with expected arguments', async () => {
        expect(callback.called).to.be.true;
        expect(
          callback.calledWith({
            isDisposed: true,
            response: errorResponseMessage.response,
            err: errorResponseMessage.response,
          }),
        ).to.be.true;
      });
      it('"err" param is defined and instance of Error', async () => {
        expect(callback.called).to.be.true;
        expect(callback.getCall(0).args[0].err).to.be.instanceof(Error);
      });
      it('propagates consumer error', async () => {
        callback = sinon.spy();
        subscription = client.createSubscriptionHandler(
          msg,
          callback,
        );
        subscription(consumerErrorMessage);
        expect(callback.called).to.be.true;
        expect(callback.getCall(0).args[0].err).to.be.equal(consumerErrorMessage.err);
      });
      it('takes NAT error over consumer one', async () => {
        callback = sinon.spy();
        subscription = client.createSubscriptionHandler(
          msg,
          callback,
        );
        const natResponseError = new Error('NAT error');
        subscription({
          ...consumerErrorMessage,
          response: natResponseError,
        });
        expect(callback.called).to.be.true;
        expect(callback.getCall(0).args[0].err).to.be.equal(natResponseError);
      });
    });
  });
  describe('close', () => {
    let natsClose: sinon.SinonSpy;
    let natsClient;
    beforeEach(() => {
      natsClose = sinon.spy();
      natsClient = { close: natsClose };
      (client as any).natsClient = natsClient;
    });
    it('should close "natsClient" when it is not null', () => {
      client.close();
      expect(natsClose.called).to.be.true;
    });
  });
  describe('connect', () => {
    let createClientSpy: sinon.SinonSpy;
    let handleErrorsSpy: sinon.SinonSpy;
    let connect$Spy: sinon.SinonSpy;

    const natsClient = {
      addListener: sinon.spy(),
      on: (ev, fn) => (ev === 'connect' ? fn() : null),
      removeListener: sinon.spy(),
      off: sinon.spy(),
    };

    beforeEach(async () => {
      createClientSpy = sinon
        .stub(client, 'createClient')
        .callsFake(() => natsClient as any);
      handleErrorsSpy = sinon.spy(client, 'handleError');
      connect$Spy = sinon.spy(client, 'connect$' as any);

      await client.connect();
    });
    afterEach(() => {
      createClientSpy.restore();
      handleErrorsSpy.restore();
      connect$Spy.restore();
    });
    describe('when is not connected', () => {
      beforeEach(async () => {
        client['natsClient'] = null;
        await client.connect();
      });
      it('should call "handleError" once', async () => {
        expect(handleErrorsSpy.called).to.be.true;
      });
      it('should call "createClient" once', async () => {
        expect(createClientSpy.called).to.be.true;
      });
      it('should call "connect$" once', async () => {
        expect(connect$Spy.called).to.be.true;
      });
    });
    describe('when is connected', () => {
      beforeEach(() => {
        client['natsClient'] = { test: true } as any;
        client['connection'] = Promise.resolve(true);
      });
      it('should not call "createClient"', () => {
        expect(createClientSpy.called).to.be.false;
      });
      it('should not call "handleError"', () => {
        expect(handleErrorsSpy.called).to.be.false;
      });
      it('should not call "connect$"', () => {
        expect(connect$Spy.called).to.be.false;
      });
    });
  });
  describe('handleError', () => {
    it('should bind error event handler', () => {
      const callback = sinon.stub().callsFake((_, fn) => fn({ code: 'test' }));
      const emitter = {
        addListener: callback,
      };
      client.handleError(emitter as any);
      expect(callback.getCall(0).args[0]).to.be.eql(ERROR_EVENT);
    });
  });
  describe('dispatchEvent', () => {
    const msg = { pattern: 'pattern', data: 'data' };
    let publishStub: sinon.SinonStub, natsClient;

    beforeEach(() => {
      publishStub = sinon.stub();
      natsClient = {
        publish: publishStub,
      };
      (client as any).natsClient = natsClient;
    });

    it('should publish packet', async () => {
      publishStub.callsFake((a, b, c) => c());
      await client['dispatchEvent'](msg);

      expect(publishStub.called).to.be.true;
    });
    it('should throw error', async () => {
      publishStub.callsFake((a, b, c) => c(new Error()));
      client['dispatchEvent'](msg).catch(err =>
        expect(err).to.be.instanceOf(Error),
      );
    });
  });
});
