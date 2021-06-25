import { ModuleMetadata, Type } from '../common/interfaces';
import { MetadataScanner } from '../core';
import { HttpTestingHandler } from './handlers/http-testing-handler';
import { RpcTestingHandler } from './handlers/rpc-testing-handler';
import { WsTestingHandler } from './handlers/ws-testing-handler';
import { TestingModuleBuilder } from './testing-module.builder';
import { MethodProperty } from './types/method-property';

export class Test {
  private static readonly metadataScanner = new MetadataScanner();

  public static createTestingModule(metadata: ModuleMetadata) {
    return new TestingModuleBuilder(this.metadataScanner, metadata);
  }
}
