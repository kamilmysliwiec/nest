import { Type } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common/interfaces';
import { MultipartOptions } from './multipart-options.interface';

export type MultipartModuleOptions = MultipartOptions;

export interface MultipartOptionsFactory {
  createMultipartOptions():
    | Promise<MultipartModuleOptions>
    | MultipartModuleOptions;
}

export interface MultipartModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<MultipartOptionsFactory>;
  useClass?: Type<MultipartOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<MultipartModuleOptions> | MultipartModuleOptions;
  inject?: any[];
}
