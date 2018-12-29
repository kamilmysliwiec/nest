import * as asyncHooks from 'async_hooks';
import { AsyncHooksStorage } from './async-hooks-storage';

export class AsyncHooksHelper {
  static createHooks(storage: AsyncHooksStorage): asyncHooks.AsyncHook {
    function init(
      asyncId: number,
      type: string,
      triggerId: number,
      resource: Object,
    ) {
      if (storage.has(triggerId)) {
        storage.inherit(asyncId, triggerId);
      }
    }

    function destroy(asyncId) {
      storage.delete(asyncId);
    }

    return asyncHooks.createHook({
      init,
      destroy,
    } as asyncHooks.HookCallbacks);
  }
}
