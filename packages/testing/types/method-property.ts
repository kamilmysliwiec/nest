type PropertyOfType<T, A> = {
  [P in keyof T]: T[P] extends A ? P : never;
}[keyof T];
export type MethodProperty<T> = PropertyOfType<T, (...args: any[]) => any>;
