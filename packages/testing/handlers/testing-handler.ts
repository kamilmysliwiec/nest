export interface TestingHandler<TOutput = any> {
  run(): Promise<TOutput>;
}
