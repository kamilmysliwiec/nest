import { HttpServer, HttpStatus, RequestMethod } from '@nestjs/common';
import { isFunction } from '@nestjs/common/utils/shared.utils';

export interface CustomHeader {
  name: string;
  value: string;
}

export interface RedirectResponse {
  url: string;
  statusCode: number;
}
export class RouterResponseController {
  constructor(private readonly applicationRef: HttpServer) {}

  public async apply<TInput = any, TResponse = any>(
    result: TInput,
    response: TResponse,
    httpStatusCode?: number,
  ) {
    return this.applicationRef.reply(response, result, httpStatusCode);
  }

  public async redirect<TInput = any, TResponse = any>(
    resultOrDeferred: TInput,
    response: TResponse,
    redirectResponse: RedirectResponse,
  ) {
    const result = await this.transformToResult(resultOrDeferred);
    const statusCode =
      result && result.statusCode
        ? result.statusCode
        : redirectResponse.statusCode
        ? redirectResponse.statusCode
        : HttpStatus.FOUND;
    const url = result && result.url ? result.url : redirectResponse.url;
    this.applicationRef.redirect(response, statusCode, url);
  }

  public render<TInput = any, TResponse = any>(
    result: TInput,
    response: TResponse,
    template: string,
  ) {
    this.applicationRef.render(response, template, result);
  }

  public canRenderToString(): boolean {
    return (
      !!this.applicationRef.renderToString &&
      isFunction(this.applicationRef.renderToString)
    );
  }
  public async renderToString(result: any, response: any, template: string) {
    const view = await this.applicationRef.renderToString!(
      template,
      result,
      response,
    );
    this.setContentTypeHtml(response);
    return view;
  }

  public async transformToResult(resultOrDeferred: any) {
    if (resultOrDeferred && isFunction(resultOrDeferred.subscribe)) {
      return resultOrDeferred.toPromise();
    }
    return resultOrDeferred;
  }

  public getStatusByMethod(requestMethod: RequestMethod): number {
    switch (requestMethod) {
      case RequestMethod.POST:
        return HttpStatus.CREATED;
      default:
        return HttpStatus.OK;
    }
  }

  public setHeaders<TResponse = any>(
    response: TResponse,
    headers: CustomHeader[],
  ) {
    headers.forEach(({ name, value }) =>
      this.applicationRef.setHeader(response, name, value),
    );
  }

  public setContentTypeHtml(response: any) {
    this.setHeaders(response, [
      { name: 'Content-Type', value: 'text/html; charset=utf-8' },
    ]);
  }

  public setStatus<TResponse = any>(response: TResponse, statusCode: number) {
    this.applicationRef.status(response, statusCode);
  }
}
