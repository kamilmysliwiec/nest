export const UnknownDependenciesMessage = (
  type: string,
  index: number,
  length: number,
) => {
  let message = `Nest can't resolve dependencies of the ${type}`;
  message += ` (`;

  const args = new Array(length).fill('+');
  args[index] = '?';
  message += args.join(', ');

  message += `). Please make sure that the argument at index [${index}] is available in the current context.`;
  return message;
};

export const InvalidMiddlewareMessage = (name: string) =>
  `The middleware doesn't provide the 'resolve' method (${name})`;

export const InvalidModuleMessage = (scope: string) =>
  `Nest cannot create the module instance. Often, this is because of a circular dependency between modules. Use forwardRef() to avoid it. (Read more https://docs.nestjs.com/advanced/circular-dependency.) Scope [${scope}]`;

export const UnknownExportMessage = (module: string) =>
  `Nest cannot export a component/module that is not a part of the currently processed module (${module}). Please verify whether each exported unit is available in this particular context.`;

export const INVALID_MIDDLEWARE_CONFIGURATION = `Invalid middleware configuration passed inside the module 'configure()' method.`;
export const UNKNOWN_REQUEST_MAPPING = `Request mapping properties not defined in the @RequestMapping() annotation!`;
export const UNHANDLED_RUNTIME_EXCEPTION = `Unhandled Runtime Exception.`;
export const INVALID_EXCEPTION_FILTER = `Invalid exception filters (@UseFilters()).`;
export const MICROSERVICES_PACKAGE_NOT_FOUND_EXCEPTION = `Unable to load @nestjs/microservices package. (Please make sure that it's already installed.)`;
