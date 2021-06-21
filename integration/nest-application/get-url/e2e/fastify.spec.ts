import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { expect } from 'chai';
import { AppModule } from '../src/app.module';
import { randomPort } from './utils';

describe('Get URL (Fastify Application)', () => {
  let port: number;
  let app: INestApplication;

  beforeEach(async () => {
    port = await randomPort();
    const testModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = testModule.createNestApplication(new FastifyAdapter());
  });

  afterEach(async () => {
    app && (await app.close());
  });

  it('should be able to get the IPv4 address', async () => {
    await app.listen(port, '127.0.0.1');
    expect(await app.getUrl()).to.be.eql(`http://127.0.0.1:${port}`);
  });
  it('should return 127.0.0.1 for 0.0.0.0', async () => {
    await app.listen(port, '0.0.0.0');
    expect(await app.getUrl()).to.be.eql(`http://127.0.0.1:${port}`);
  });
  it('should be able to get the IPv4 address after app is listening', async () => {
    await app.listenAsync(port, '0.0.0.0');
    expect(await app.getUrl()).to.be.eql(`http://127.0.0.1:${port}`);
  });
  it('should be able to get the IPv4 address in a callback', done => {
    app.listen(port, '0.0.0.0', async () => {
      expect(await app.getUrl()).to.be.eql(`http://127.0.0.1:${port}`);
      done();
    });
  });
  it('should throw an error for calling getUrl before listen', async () => {
    let err: any;
    try {
      await app.getUrl();
    } catch (error) {
      err = error;
    }
    expect(err).to.be.eql(
      'app.listen() needs to be called before calling app.getUrl()',
    );
  });
});
