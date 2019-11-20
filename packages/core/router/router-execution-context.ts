import {
  ForbiddenException,
  ParamData,
  PipeTransform,
  RequestMethod,
} from '@nestjs/common';
import {
  CUSTOM_ROUTE_AGRS_METADATA,
  HEADERS_METADATA,
  HTTP_CODE_METADATA,
  REDIRECT_METADATA,
  RENDER_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { RouteParamMetadata } from '@nestjs/common/decorators';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ContextType, Controller } from '@nestjs/common/interfaces';
import {
  isEmpty,
  isFunction,
  isString,
} from '@nestjs/common/utils/shared.utils';
import { FORBIDDEN_MESSAGE } from '../guards/constants';
import { GuardsConsumer } from '../guards/guards-consumer';
import { GuardsContextCreator } from '../guards/guards-context-creator';
import { ContextUtils } from '../helpers/context-utils';
import {
  HandlerMetadata,
  HandlerMetadataStorage,
} from '../helpers/handler-metadata-storage';
import { STATIC_CONTEXT } from '../injector/constants';
import { RouterInterceptorsConsumer } from '../interceptors/router-interceptors-consumer';
import { InterceptorsContextCreator } from '../interceptors/interceptors-context-creator';
import { PipesConsumer } from '../pipes/pipes-consumer';
import { PipesContextCreator } from '../pipes/pipes-context-creator';
import { IRouteParamsFactory } from './interfaces/route-params-factory.interface';
import {
  CustomHeader,
  RedirectResponse,
  RouterResponseController,
} from './router-response-controller';

export interface ParamProperties {
  index: number;
  type: RouteParamtypes | string;
  data: ParamData;
  pipes: PipeTransform[];
  extractValue: <TRequest, TResponse>(
    req: TRequest,
    res: TResponse,
    next: Function,
  ) => any;
}

export class RouterExecutionContext {
  private readonly handlerMetadataStorage = new HandlerMetadataStorage();
  private readonly contextUtils = new ContextUtils();

  constructor(
    private readonly paramsFactory: IRouteParamsFactory,
    private readonly pipesContextCreator: PipesContextCreator,
    private readonly pipesConsumer: PipesConsumer,
    private readonly guardsContextCreator: GuardsContextCreator,
    private readonly guardsConsumer: GuardsConsumer,
    private readonly interceptorsContextCreator: InterceptorsContextCreator,
    private readonly interceptorsConsumer: RouterInterceptorsConsumer,
    private readonly responseController: RouterResponseController,
  ) {}
  public create(
    instance: Controller,
    callback: (...args: any[]) => any,
    methodName: string,
    module: string,
    requestMethod: RequestMethod,
    contextId = STATIC_CONTEXT,
    inquirerId?: string,
  ) {
    const {
      argsLength,
      fnHandleResponse,
      paramtypes,
      getParamsMetadata,
      httpStatusCode,
      responseHeaders,
      hasCustomHeaders,
    } = this.getMetadata(instance, callback, methodName, module, requestMethod);

    const paramsOptions = this.contextUtils.mergeParamsMetatypes(
      getParamsMetadata(module, contextId, inquirerId),
      paramtypes,
    );
    const contextType: ContextType = 'http';
    const pipes = this.pipesContextCreator.create(
      instance,
      callback,
      module,
      contextId,
      inquirerId,
    );
    const guards = this.guardsContextCreator.create(
      instance,
      callback,
      module,
      contextId,
      inquirerId,
    );
    const interceptors = this.interceptorsContextCreator.create(
      instance,
      callback,
      module,
      contextId,
      inquirerId,
    );

    const fnCanActivate = this.createGuardsFn(
      guards,
      instance,
      callback,
      contextType,
    );
    const fnApplyPipes = this.createPipesFn(pipes, paramsOptions);

    const handler = <TRequest, TResponse>(
      args: any[],
      req: TRequest,
      res: TResponse,
      next: Function,
    ) => async () => {
      fnApplyPipes && (await fnApplyPipes(args, req, res, next));
      return callback.apply(instance, args);
    };

    return async <TRequest, TResponse>(
      req: TRequest,
      res: TResponse,
      next: Function,
    ) => {
      const args = this.contextUtils.createNullArray(argsLength);
      fnCanActivate && (await fnCanActivate([req, res, next]));

      this.responseController.setStatus(res, httpStatusCode);
      hasCustomHeaders &&
        this.responseController.setHeaders(res, responseHeaders);

      const {
        result,
        skipRender,
      } = await this.interceptorsConsumer.interceptHandlerResponse(
        interceptors,
        [req, res, next],
        instance,
        callback,
        handler(args, req, res, next),
      );

      await fnHandleResponse(result, res, skipRender);
    };
  }

  public getMetadata(
    instance: Controller,
    callback: (...args: any[]) => any,
    methodName: string,
    module: string,
    requestMethod: RequestMethod,
  ): HandlerMetadata {
    const cacheMetadata = this.handlerMetadataStorage.get(instance, methodName);
    if (cacheMetadata) {
      return cacheMetadata;
    }
    const metadata =
      this.contextUtils.reflectCallbackMetadata(
        instance,
        methodName,
        ROUTE_ARGS_METADATA,
      ) || {};
    const keys = Object.keys(metadata);
    const argsLength = this.contextUtils.getArgumentsLength(keys, metadata);
    const paramtypes = this.contextUtils.reflectCallbackParamtypes(
      instance,
      methodName,
    );
    const getParamsMetadata = (
      moduleKey: string,
      contextId = STATIC_CONTEXT,
      inquirerId?: string,
    ) =>
      this.exchangeKeysForValues(
        keys,
        metadata,
        moduleKey,
        contextId,
        inquirerId,
      );

    const paramsMetadata = getParamsMetadata(module);
    const isResponseHandled = paramsMetadata.some(
      ({ type }) =>
        type === RouteParamtypes.RESPONSE || type === RouteParamtypes.NEXT,
    );

    const httpRedirectResponse = this.reflectRedirect(callback);
    const fnHandleResponse = this.createHandleResponseFn(
      callback,
      isResponseHandled,
      httpRedirectResponse,
    );

    const httpCode = this.reflectHttpStatusCode(callback);
    const httpStatusCode = httpCode
      ? httpCode
      : this.responseController.getStatusByMethod(requestMethod);

    const responseHeaders = this.reflectResponseHeaders(callback);
    const hasCustomHeaders = !isEmpty(responseHeaders);
    const handlerMetadata: HandlerMetadata = {
      argsLength,
      fnHandleResponse,
      paramtypes,
      getParamsMetadata,
      httpStatusCode,
      hasCustomHeaders,
      responseHeaders,
    };
    this.handlerMetadataStorage.set(instance, methodName, handlerMetadata);
    return handlerMetadata;
  }

  public reflectRedirect(callback: (...args: any[]) => any): RedirectResponse {
    return Reflect.getMetadata(REDIRECT_METADATA, callback);
  }

  public reflectHttpStatusCode(callback: (...args: any[]) => any): number {
    return Reflect.getMetadata(HTTP_CODE_METADATA, callback);
  }

  public reflectRenderTemplate(callback: (...args: any[]) => any): string {
    return Reflect.getMetadata(RENDER_METADATA, callback);
  }

  public reflectResponseHeaders(
    callback: (...args: any[]) => any,
  ): CustomHeader[] {
    return Reflect.getMetadata(HEADERS_METADATA, callback) || [];
  }

  public exchangeKeysForValues(
    keys: string[],
    metadata: Record<number, RouteParamMetadata>,
    moduleContext: string,
    contextId = STATIC_CONTEXT,
    inquirerId?: string,
  ): ParamProperties[] {
    this.pipesContextCreator.setModuleContext(moduleContext);
    return keys.map(key => {
      const { index, data, pipes: pipesCollection } = metadata[key];
      const pipes = this.pipesContextCreator.createConcreteContext(
        pipesCollection,
        contextId,
        inquirerId,
      );
      const type = this.contextUtils.mapParamType(key);

      if (key.includes(CUSTOM_ROUTE_AGRS_METADATA)) {
        const { factory } = metadata[key];
        const customExtractValue = this.getCustomFactory(factory, data);
        return { index, extractValue: customExtractValue, type, data, pipes };
      }
      const numericType = Number(type);
      const extractValue = <TRequest, TResponse>(
        req: TRequest,
        res: TResponse,
        next: Function,
      ) =>
        this.paramsFactory.exchangeKeyForValue(numericType, data, {
          req,
          res,
          next,
        });
      return { index, extractValue, type: numericType, data, pipes };
    });
  }

  public getCustomFactory(
    factory: (...args: unknown[]) => void,
    data: unknown,
  ): (...args: unknown[]) => unknown {
    return isFunction(factory)
      ? (req, res, next) => factory(data, req)
      : () => null;
  }

  public async getParamValue<T>(
    value: T,
    {
      metatype,
      type,
      data,
    }: { metatype: unknown; type: RouteParamtypes; data: unknown },
    pipes: PipeTransform[],
  ): Promise<unknown> {
    if (!isEmpty(pipes)) {
      return this.pipesConsumer.apply(
        value,
        { metatype, type, data } as any,
        pipes,
      );
    }
    return value;
  }

  public isPipeable(type: number | string): boolean {
    return (
      type === RouteParamtypes.BODY ||
      type === RouteParamtypes.QUERY ||
      type === RouteParamtypes.PARAM ||
      isString(type)
    );
  }

  public createGuardsFn<TContext extends ContextType = ContextType>(
    guards: any[],
    instance: Controller,
    callback: (...args: any[]) => any,
    contextType?: TContext,
  ): Function | null {
    const canActivateFn = async (args: any[]) => {
      const canActivate = await this.guardsConsumer.tryActivate<TContext>(
        guards,
        args,
        instance,
        callback,
        contextType,
      );
      if (!canActivate) {
        throw new ForbiddenException(FORBIDDEN_MESSAGE);
      }
    };
    return guards.length ? canActivateFn : null;
  }

  public createPipesFn(
    pipes: PipeTransform[],
    paramsOptions: (ParamProperties & { metatype?: any })[],
  ) {
    const pipesFn = async <TRequest, TResponse>(
      args: any[],
      req: TRequest,
      res: TResponse,
      next: Function,
    ) => {
      const resolveParamValue = async (
        param: ParamProperties & { metatype?: any },
      ) => {
        const {
          index,
          extractValue,
          type,
          data,
          metatype,
          pipes: paramPipes,
        } = param;
        const value = extractValue(req, res, next);

        args[index] = this.isPipeable(type)
          ? await this.getParamValue(
              value,
              { metatype, type, data } as any,
              pipes.concat(paramPipes),
            )
          : value;
      };
      await Promise.all(paramsOptions.map(resolveParamValue));
    };
    return paramsOptions.length ? pipesFn : null;
  }

  public createHandleResponseFn(
    callback: (...args: any[]) => any,
    isResponseHandled: boolean,
    redirectResponse?: RedirectResponse,
    httpStatusCode?: number,
  ): HandlerMetadata['fnHandleResponse'] {
    const renderTemplate = this.reflectRenderTemplate(callback);
    if (renderTemplate) {
      return async <TResult, TResponse>(
        result: TResult,
        res: TResponse,
        skipRender: boolean,
      ) => {
        result = await this.responseController.transformToResult(result);
        if (skipRender) {
          this.responseController.setContentTypeHtml(res);
        }
        if (skipRender && !isString(result)) {
          throw new Error(
            'NestInterceptor.intercept rendered - result is not a string',
          );
        }
        if (
          this.interceptorsConsumer.canRenderIntercept() &&
          (skipRender || this.responseController.canRenderToString())
        ) {
          const renderedView = skipRender
            ? ((result as unknown) as string)
            : await this.responseController.renderToString(
                result,
                res,
                renderTemplate,
              );
          result = await this.responseController.transformToResult(
            await this.interceptorsConsumer.renderIntercept(renderedView),
          );
          await this.responseController.apply(result, res, httpStatusCode);
        } else if (skipRender) {
          await this.responseController.apply(result, res, httpStatusCode);
        } else {
          await this.responseController.render(result, res, renderTemplate);
        }
      };
    }
    if (redirectResponse && redirectResponse.url) {
      return async <TResult, TResponse>(result: TResult, res: TResponse) => {
        await this.responseController.redirect(result, res, redirectResponse);
      };
    }
    return async <TResult, TResponse>(result: TResult, res: TResponse) => {
      result = await this.responseController.transformToResult(result);
      !isResponseHandled &&
        (await this.responseController.apply(result, res, httpStatusCode));
    };
  }
}
