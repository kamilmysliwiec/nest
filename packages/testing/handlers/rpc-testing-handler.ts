import { TestingHandler } from './testing-handler';

/**
 * RPC handler based on an existing Controller class and method.
 *
 * Eases testing by running the execution chain (pipes, guards,
 * interceptors) of a RPC controller.
 */
export class RpcTestingHandler<TOutput> implements TestingHandler<TOutput> {
  private data: any;
  private context: any;

  private constructor(
    private readonly createContext: () => (...args: any[]) => Promise<TOutput>,
  ) {}

  /**
   * Create a new instance of `RpcTestingHandler`, with
   * @template TOutput Expected type of the response sent to the client.
   *
   * @param createContext Function building the context handler.
   * @param controllerClass Target controller class.
   * @param methodName Controller method name.
   *
   * @return New instance of RpcTestingHandler.
   */
  public static create<TOutput>(
    createContext: () => (...args: any[]) => Promise<TOutput>,
  ) {
    return new RpcTestingHandler<TOutput>(createContext);
  }

  setData(data: any) {
    this.data = data;
    return this;
  }

  setContext(context: any) {
    this.context = context;
    return this;
  }

  async run(): Promise<TOutput> {
    const runnable = await this.createContext();
    return runnable(this.data, this.context);
  }
}
