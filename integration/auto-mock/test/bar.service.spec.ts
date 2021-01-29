import { Test } from '@nestjs/testing';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { BarService } from '../src/bar.service';

describe('Auto-Mocking Bar Deps', () => {
  let service: BarService;
  let stub = sinon.stub();
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [BarService],
    })
      .useMocker(() => ({ foo: stub }))
      .compile();
    service = moduleRef.get(BarService);
  });

  it('should be defined', () => {
    expect(service).not.to.be.undefined;
  });
  it('should call bar.bar', () => {
    console.log(service);
    service.bar();
    expect(stub.called);
  });
});
