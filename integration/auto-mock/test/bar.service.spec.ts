import { Test } from '@nestjs/testing';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { BarService } from '../src/bar.service';
import { FooService } from '../src/foo.service';

describe('Auto-Mocking Bar Deps', () => {
  let service: BarService;
  let fooService: FooService;
  const stub = sinon.stub();
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [BarService],
    })
      .useMocker(() => ({ foo: stub }))
      .compile();
    service = moduleRef.get(BarService);
    fooService = moduleRef.get(FooService);
    console.log(fooService);
  });

  it('should be defined', () => {
    expect(service).not.to.be.undefined;
    expect(fooService).not.to.be.undefined;
  });
  it('should call bar.bar', () => {
    service.bar();
    expect(stub.called);
  });
});
