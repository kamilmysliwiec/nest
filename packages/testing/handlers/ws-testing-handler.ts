import { TestingHandler } from './testing-handler';

/**
 * WebSocket handler based on an existing Gateway class and method.
 *
 * Eases testing by running the execution chain (pipes, guards,
 * interceptors) of a WebSocket gateway.
 */
export class WsTestingHandler<TOutput> implements TestingHandler<TOutput> {
  private client: any;
  private data: any;

  private constructor(
    private readonly createContext: () => (...args: any[]) => Promise<TOutput>,
  ) {}

  /**
   * Create a new instance of `WsTestingHandler`, with
   * @template TOutput Expected type of the response sent to the client.
   *
   * @param createContext Function building the context handler.
   *
   * @return New instance of WsTestingHandler.
   */
  public static create<TOutput>(
    createContext: () => (...args: any[]) => Promise<TOutput>,
  ) {
    return new WsTestingHandler<TOutput>(createContext);
  }

  setClient(client: any) {
    this.client = client;
    return this;
  }

  setData(data: any) {
    this.data = data;
    return this;
  }

  async run(): Promise<TOutput> {
    const runnable = await this.createContext();
    return runnable(this.client, this.data);
  }
}
