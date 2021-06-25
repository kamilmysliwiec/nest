import { TestingHandler } from './testing-handler';

type ObjectLiteral = Record<string | symbol, unknown>;
type TestRequest = {
  ip?: string;
  session?: any;
  body?: ObjectLiteral;
  headers?: ObjectLiteral;
  params?: ObjectLiteral;
  hosts?: ObjectLiteral;
  query?: ObjectLiteral;
  file?: ObjectLiteral;
  files?: ObjectLiteral;
};

/**
 * HTTP handler based on an existing Controller class and method.
 *
 * Eases testing by running the execution chain (pipes, guards,
 * interceptors) of an HTTP controller.
 */
export class HttpTestingHandler<TOutput> implements TestingHandler<TOutput> {
  private req: TestRequest;

  private constructor(
    private readonly createContext: () => (...args: any[]) => Promise<TOutput>,
  ) {}

  /**
   * Create a new instance of `HttpTestingHandler`, with
   * @template TOutput Expected type of the response sent to the client.
   *
   * * @param createContext Function building the context handler.
   * @param controllerClass Target controller class.
   * @param methodName Controller method name.
   *
   * @return New instance of HttpTestingHandler.
   */
  public static create<TOutput>(
    createContext: () => (...args: any[]) => Promise<TOutput>,
  ) {
    return new HttpTestingHandler<TOutput>(createContext);
  }

  setRequest(req: TestRequest) {
    this.req = {
      headers: {},
      body: {},
      params: {},
      query: {},
      ...req,
    };
    return this;
  }

  async run(): Promise<TOutput> {
    const runnable = await this.createContext();
    return runnable(this.req);
  }
}
