import { Test } from '@nestjs/testing';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { BarService } from '../src/bar.service';
import { FooService } from '../src/foo.service';
chai.use(chaiAsPromised);
const { expect } = chai;

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

describe('Auto-Mocking with token in factory', () => {
  it('can mock the dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [BarService],
    })
      .useMocker((token) => {
        if (token === FooService.name) {
          return { foo: sinon.stub };
        }
      })
      .compile();
    const service = moduleRef.get(BarService);
    const fooServ = moduleRef.get<{ foo: sinon.SinonStub }>('FooService');
    service.bar();
    expect(fooServ.foo.called);
  });
  it('cannot mock the dependencies', async () => {

    const moduleRef = Test.createTestingModule({
      providers: [BarService],
    })
      .useMocker((token) => {
        if (token === FooService.name + 'something that fails the token') {
          return { foo: sinon.stub };
        }
      })
      .compile;
    expect(moduleRef()).to.eventually.throw()
  });
});
