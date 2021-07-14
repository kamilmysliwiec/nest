import { Logger } from '@nestjs/common';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { NO_MESSAGE_HANDLER } from '../../constants';
import { KafkaHeaders } from '../../enums';
import {
  EachMessagePayload,
  KafkaMessage,
} from '../../external/kafka.interface';
import { ServerKafka } from '../../server';

class NoopLogger extends Logger {
  log(message: any, context?: string): void {}
  error(message: any, trace?: string, context?: string): void {}
  warn(message: any, context?: string): void {}
}

describe('ServerKafka', () => {
  const objectToMap = obj =>
    new Map(Object.keys(obj).map(i => [i, obj[i]]) as any);

  const topic = 'test.topic';
  const replyTopic = 'test.topic.reply';
  const replyPartition = '0';
  const correlationId = '696fa0a9-1827-4e59-baef-f3628173fe4f';
  const key = '1';
  const timestamp = new Date().toISOString();
  const messageValue = 'test-message';

  const eventMessage: KafkaMessage = {
    key: Buffer.from(key),
    offset: '0',
    size: messageValue.length,
    value: Buffer.from(messageValue),
    timestamp,
    attributes: 1,
  };
  const eventPayload: EachMessagePayload = {
    topic,
    partition: 0,
    message: Object.assign(
      {
        headers: {},
      },
      eventMessage,
    ),
  };

  const eventWithCorrelationIdPayload: EachMessagePayload = {
    topic,
    partition: 0,
    message: Object.assign(
      {
        headers: {
          [KafkaHeaders.CORRELATION_ID]: Buffer.from(correlationId),
        },
      },
      eventMessage,
    ),
  };

  const message: KafkaMessage = Object.assign(
    {
      headers: {
        [KafkaHeaders.CORRELATION_ID]: Buffer.from(correlationId),
        [KafkaHeaders.REPLY_TOPIC]: Buffer.from(replyTopic),
        [KafkaHeaders.REPLY_PARTITION]: Buffer.from(replyPartition),
      },
    },
    eventMessage,
  );
  const payload: EachMessagePayload = {
    topic,
    partition: 0,
    message,
  };

  let server: ServerKafka;
  let callback: sinon.SinonSpy;
  let bindEventsStub: sinon.SinonStub;
  let connect: sinon.SinonSpy;
  let subscribe: sinon.SinonSpy;
  let run: sinon.SinonSpy;
  let send: sinon.SinonSpy;
  let consumerStub: sinon.SinonStub;
  let producerStub: sinon.SinonStub;
  let client;

  beforeEach(() => {
    server = new ServerKafka({});
    callback = sinon.spy();
    connect = sinon.spy();
    subscribe = sinon.spy();
    run = sinon.spy();
    send = sinon.spy();

    consumerStub = sinon.stub(server as any, 'consumer').callsFake(() => {
      return {
        connect,
        subscribe,
        run,
      };
    });
    producerStub = sinon.stub(server as any, 'producer').callsFake(() => {
      return {
        connect,
        send,
      };
    });
    client = {
      consumer: consumerStub,
      producer: producerStub,
    };
    sinon.stub(server, 'createClient').callsFake(() => client);
  });

  describe('listen', () => {
    it('should call "bindEvents"', async () => {
      bindEventsStub = sinon
        .stub(server, 'bindEvents')
        .callsFake(() => ({} as any));
      await server.listen(callback);
      expect(bindEventsStub.called).to.be.true;
    });
    it('should call callback', async () => {
      await server.listen(callback);
      expect(callback.called).to.be.true;
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
    const consumer = { disconnect: sinon.spy() };
    const producer = { disconnect: sinon.spy() };
    beforeEach(() => {
      (server as any).consumer = consumer;
      (server as any).producer = producer;
    });
    it('should close server', async () => {
      await server.close();

      expect(consumer.disconnect.calledOnce).to.be.true;
      expect(producer.disconnect.calledOnce).to.be.true;
      expect((server as any).consumer).to.be.null;
      expect((server as any).producer).to.be.null;
      expect((server as any).client).to.be.null;
    });
  });

  describe('bindEvents', () => {
    it('should not call subscribe nor run on consumer when there are no messageHandlers', async () => {
      (server as any).logger = new NoopLogger();
      await server.listen(callback);
      await server.bindEvents((server as any).consumer);
      expect(subscribe.called).to.be.false;
      expect(run.called).to.be.true;
      expect(connect.called).to.be.true;
    });
    it('should call subscribe and run on consumer when there are messageHandlers', async () => {
      (server as any).logger = new NoopLogger();
      await server.listen(callback);

      const pattern = 'test';
      const handler = sinon.spy();
      (server as any).messageHandlers = objectToMap({
        [pattern]: handler,
      });

      await server.bindEvents((server as any).consumer);

      expect(subscribe.called).to.be.true;
      expect(
        subscribe.calledWith({
          topic: pattern,
        }),
      ).to.be.true;

      expect(run.called).to.be.true;
      expect(connect.called).to.be.true;
    });
    it('should call subscribe with options and run on consumer when there are messageHandlers', async () => {
      (server as any).logger = new NoopLogger();
      (server as any).options.subscribe = {};
      (server as any).options.subscribe.fromBeginning = true;
      await server.listen(callback);

      const pattern = 'test';
      const handler = sinon.spy();
      (server as any).messageHandlers = objectToMap({
        [pattern]: handler,
      });

      await server.bindEvents((server as any).consumer);

      expect(subscribe.called).to.be.true;
      expect(
        subscribe.calledWith({
          topic: pattern,
          fromBeginning: true,
        }),
      ).to.be.true;

      expect(run.called).to.be.true;
      expect(connect.called).to.be.true;
    });
  });

  describe('getMessageHandler', () => {
    it(`should return function`, () => {
      expect(typeof server.getMessageHandler()).to.be.eql('function');
    });
    describe('handler', () => {
      it('should call "handleMessage"', async () => {
        const handleMessageStub = sinon
          .stub(server, 'handleMessage')
          .callsFake(() => null);
        (await server.getMessageHandler())(null);
        expect(handleMessageStub.called).to.be.true;
      });
    });
  });

  describe('getPublisher', () => {
    let sendMessageStub: sinon.SinonStub;
    let publisher;

    beforeEach(() => {
      publisher = server.getPublisher(
        replyTopic,
        replyPartition,
        correlationId,
      );
      sendMessageStub = sinon
        .stub(server, 'sendMessage')
        .callsFake(async () => []);
    });
    it(`should return function`, () => {
      expect(typeof server.getPublisher(null, null, correlationId)).to.be.eql(
        'function',
      );
    });
    it(`should call "publish" with expected arguments`, () => {
      const data = {
        id: 'uuid',
        value: 'string',
      };
      publisher(data);

      expect(
        sendMessageStub.calledWith(
          data,
          replyTopic,
          replyPartition,
          correlationId,
        ),
      ).to.be.true;
    });
  });

  describe('handleMessage', () => {
    let getPublisherSpy: sinon.SinonSpy;

    beforeEach(() => {
      sinon.stub(server, 'sendMessage').callsFake(async () => []);
      getPublisherSpy = sinon.spy();

      sinon.stub(server, 'getPublisher').callsFake(() => getPublisherSpy);
    });
    it('should call "handleEvent" if correlation identifier is not present', async () => {
      const handleEventSpy = sinon.spy(server, 'handleEvent');
      await server.handleMessage(eventPayload);
      expect(handleEventSpy.called).to.be.true;
    });

    it('should call "handleEvent" if correlation identifier is present by the reply topic is not present', async () => {
      const handleEventSpy = sinon.spy(server, 'handleEvent');
      await server.handleMessage(eventWithCorrelationIdPayload);
      expect(handleEventSpy.called).to.be.true;
    });

    it(`should publish NO_MESSAGE_HANDLER if pattern not exists in messageHandlers object`, async () => {
      await server.handleMessage(payload);
      expect(
        getPublisherSpy.calledWith({
          id: payload.message.headers[KafkaHeaders.CORRELATION_ID].toString(),
          err: NO_MESSAGE_HANDLER,
        }),
      ).to.be.true;
    });
    it(`should call handler with expected arguments`, async () => {
      const handler = sinon.spy();
      (server as any).messageHandlers = objectToMap({
        [topic]: handler,
      });

      await server.handleMessage(payload);
      expect(handler.called).to.be.true;
    });
  });

  describe('sendMessage', () => {
    let sendSpy: sinon.SinonSpy;

    beforeEach(() => {
      sendSpy = sinon.spy();
      sinon.stub(server as any, 'producer').value({
        send: sendSpy,
      });
    });

    it('should send message', () => {
      server.sendMessage(
        {
          id: correlationId,
          response: messageValue,
        },
        replyTopic,
        replyPartition,
        correlationId,
      );

      expect(
        sendSpy.calledWith({
          topic: replyTopic,
          messages: [
            {
              partition: parseFloat(replyPartition),
              value: messageValue,
              headers: {
                [KafkaHeaders.CORRELATION_ID]: Buffer.from(correlationId),
              },
            },
          ],
        }),
      ).to.be.true;
    });
    it('should send message without reply partition', () => {
      server.sendMessage(
        {
          id: correlationId,
          response: messageValue,
        },
        replyTopic,
        undefined,
        correlationId,
      );

      expect(
        sendSpy.calledWith({
          topic: replyTopic,
          messages: [
            {
              value: messageValue,
              headers: {
                [KafkaHeaders.CORRELATION_ID]: Buffer.from(correlationId),
              },
            },
          ],
        }),
      ).to.be.true;
    });
    it('should send error message', () => {
      server.sendMessage(
        {
          id: correlationId,
          err: NO_MESSAGE_HANDLER,
        },
        replyTopic,
        replyPartition,
        correlationId,
      );

      expect(
        sendSpy.calledWith({
          topic: replyTopic,
          messages: [
            {
              value: null,
              partition: parseFloat(replyPartition),
              headers: {
                [KafkaHeaders.CORRELATION_ID]: Buffer.from(correlationId),
                [KafkaHeaders.NEST_ERR]: Buffer.from(NO_MESSAGE_HANDLER),
              },
            },
          ],
        }),
      ).to.be.true;
    });
    it('should send `isDisposed` message', () => {
      server.sendMessage(
        {
          id: correlationId,
          isDisposed: true,
        },
        replyTopic,
        replyPartition,
        correlationId,
      );

      expect(
        sendSpy.calledWith({
          topic: replyTopic,
          messages: [
            {
              value: null,
              partition: parseFloat(replyPartition),
              headers: {
                [KafkaHeaders.CORRELATION_ID]: Buffer.from(correlationId),
                [KafkaHeaders.NEST_IS_DISPOSED]: Buffer.alloc(1),
              },
            },
          ],
        }),
      ).to.be.true;
    });
  });
});
