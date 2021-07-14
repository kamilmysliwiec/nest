import { DynamicModule, Module, Provider } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { MULTIPART_MODULE_OPTIONS } from './files.constants';
import {
  MultipartModuleAsyncOptions,
  MultipartModuleOptions,
  MultipartOptionsFactory,
} from './interfaces/files-upload-module.interface';
import { MULTIPART_MODULE_ID } from './multipart.constants';

@Module({})
export class MultipartModule {
  static register(options: MultipartModuleOptions = {}): DynamicModule {
    return {
      module: MultipartModule,
      providers: [
        { provide: MULTIPART_MODULE_OPTIONS, useValue: options },
        {
          provide: MULTIPART_MODULE_ID,
          useValue: randomStringGenerator(),
        },
      ],
      exports: [MULTIPART_MODULE_OPTIONS],
    };
  }

  static registerAsync(options: MultipartModuleAsyncOptions): DynamicModule {
    return {
      module: MultipartModule,
      imports: options.imports,
      providers: [
        ...this.createAsyncProviders(options),
        {
          provide: MULTIPART_MODULE_ID,
          useValue: randomStringGenerator(),
        },
      ],
      exports: [MULTIPART_MODULE_OPTIONS],
    };
  }

  private static createAsyncProviders(
    options: MultipartModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: options.useClass,
        useClass: options.useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: MultipartModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: MULTIPART_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }
    return {
      provide: MULTIPART_MODULE_OPTIONS,
      useFactory: async (optionsFactory: MultipartOptionsFactory) =>
        optionsFactory.createMultipartOptions(),
      inject: [options.useExisting || options.useClass],
    };
  }
}
