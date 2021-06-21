import { ExpressAdapter } from '@nestjs/platform-express';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { expect } from 'chai';
import * as express from 'express';
import { AppModule } from '../src/app.module';
import { randomPort } from './utils';

describe('Get URL (Express Application)', () => {
  let app: INestApplication;
  let port: number;

  beforeEach(async () => {
    port = await randomPort();
    const testModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = testModule.createNestApplication(new ExpressAdapter(express()));
  });

  afterEach(async () => {
    app && (await app.close());
  });

  it('should be able to get the IPv6 address', async () => {
    await app.listen(port);
    expect(await app.getUrl()).to.be.eql(`http://[::1]:${port}`);
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
