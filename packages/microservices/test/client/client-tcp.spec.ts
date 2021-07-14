import { expect } from 'chai';
import * as sinon from 'sinon';
import { ClientTCP } from '../../client/client-tcp';
import { ERROR_EVENT } from '../../constants';

describe('ClientTCP', () => {
  let client: ClientTCP;
  let socket;
  let createSocketStub: sinon.SinonStub;

  beforeEach(() => {
    client = new ClientTCP({});
    const onFakeCallback = (event, callback) =>
      event !== 'error' && event !== 'close' && callback({});

    socket = {
      connect: sinon.stub(),
      on: sinon.stub().callsFake(onFakeCallback),
      netSocket: {
        addListener: sinon.stub().callsFake(onFakeCallback),
        removeListener: sinon.spy(),
        once: sinon.stub().callsFake(onFakeCallback),
      },
      sendMessage: sinon.spy(),
      end: sinon.spy(),
    };
    createSocketStub = sinon
      .stub(client, 'createSocket')
      .callsFake(() => socket);
  });
  afterEach(() => {
    createSocketStub.restore();
  });
  describe('publish', () => {
    let msg;
    beforeEach(() => {
      msg = { test: 3 };
      client['isConnected'] = true;
      client['socket'] = socket;
    });
    it('should send message', () => {
      client['publish'](msg, () => ({}));
    });
    describe('on dispose', () => {
      it('should remove listener from routing map', () => {
        client['publish'](msg, () => ({}))();

        expect(client['routingMap'].size).to.be.eq(0);
      });
    });
    describe('on error', () => {
      it('should call callback', () => {
        const callback = sinon.spy();
        sinon.stub(client, 'assignPacketId' as any).callsFake(() => {
          throw new Error();
        });
        client['publish'](msg, callback);
        expect(callback.called).to.be.true;
        expect(callback.getCall(0).args[0].err).to.be.instanceof(Error);
      });
    });
  });
  describe('handleResponse', () => {
    let callback;
    const id = '1';

    describe('when disposed', () => {
      beforeEach(async () => {
        callback = sinon.spy();
        client['routingMap'].set(id, callback);
        await client.handleResponse({ id, isDisposed: true });
      });
      it('should emit disposed callback', () => {
        expect(callback.called).to.be.true;
        expect(
          callback.calledWith({
            err: undefined,
            response: undefined,
            isDisposed: true,
          }),
        ).to.be.true;
      });
    });
    describe('when not disposed', () => {
      let buffer;
      beforeEach(async () => {
        buffer = { id, err: undefined, response: 'res' };
        callback = sinon.spy();
        client['routingMap'].set(id, callback);
        await client.handleResponse(buffer);
      });
      it('should not end server', () => {
        expect(socket.end.called).to.be.false;
      });
      it('should call callback with error and response data', () => {
        expect(callback.called).to.be.true;
        expect(
          callback.calledWith({
            err: buffer.err,
            response: buffer.response,
          }),
        ).to.be.true;
      });
    });
  });
  describe('connect', () => {
    let bindEventsSpy: sinon.SinonSpy;
    let connect$Stub: sinon.SinonStub;

    beforeEach(async () => {
      bindEventsSpy = sinon.spy(client, 'bindEvents');
    });
    afterEach(() => {
      bindEventsSpy.restore();
    });
    describe('when is not connected', () => {
      beforeEach(async () => {
        client['isConnected'] = false;
        const source = {
          subscribe: ({ complete }) => complete(),
          pipe: () => source,
        };
        connect$Stub = sinon
          .stub(client, 'connect$' as any)
          .callsFake(() => source);
        await client.connect();
      });
      afterEach(() => {
        connect$Stub.restore();
      });
      it('should call "bindEvents" once', async () => {
        expect(bindEventsSpy.called).to.be.true;
      });
      it('should call "createSocket" once', async () => {
        expect(createSocketStub.called).to.be.true;
      });
      it('should call "connect$" once', async () => {
        expect(connect$Stub.called).to.be.true;
      });
      it('should listen on messages', () => {
        expect(socket.on.called).to.be.true;
      });
    });
    describe('when is connected', () => {
      beforeEach(() => {
        client['isConnected'] = true;
      });
      it('should not call "createSocket"', () => {
        expect(createSocketStub.called).to.be.false;
      });
      it('should not call "bindEvents"', () => {
        expect(bindEventsSpy.called).to.be.false;
      });
    });
  });
  describe('close', () => {
    beforeEach(() => {
      (client as any).socket = socket;
      (client as any).isConnected = true;
      client.close();
    });
    it('should end() socket', () => {
      expect(socket.end.called).to.be.true;
    });
    it('should set "isConnected" to false', () => {
      expect((client as any).isConnected).to.be.false;
    });
    it('should set "socket" to null', () => {
      expect((client as any).socket).to.be.null;
    });
  });
  describe('bindEvents', () => {
    it('should bind error event handler', () => {
      const callback = sinon.stub().callsFake((_, fn) => fn({ code: 'test' }));
      const emitter = {
        on: callback,
      };
      client.bindEvents(emitter as any);
      expect(callback.getCall(0).args[0]).to.be.eql(ERROR_EVENT);
    });
  });
  describe('dispatchEvent', () => {
    const msg = { pattern: 'pattern', data: 'data' };
    let sendMessageStub: sinon.SinonStub, internalSocket;

    beforeEach(() => {
      sendMessageStub = sinon.stub();
      internalSocket = {
        sendMessage: sendMessageStub,
      };
      (client as any).socket = internalSocket;
    });

    it('should publish packet', async () => {
      await client['dispatchEvent'](msg);

      expect(sendMessageStub.called).to.be.true;
    });
  });
});
