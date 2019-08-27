import { MIXED_MULTI_PROVIDER_MESSAGE } from '../messages';
import { RuntimeException } from './runtime.exception';

/**
 * Errors which should get thrown when the user
 * mixes up the `multi` option of a provider
 *
 * ```typescript
 * // Will throw an exception
 * @Module({
 *   providers: [
 *     {
 *       useValue: 'eng',
 *       provide: 'LANG',
 *       multi: true,
 *     },
 *     {
 *       useValue: 'de',
 *       provide: 'LANG',
 *       // Not allowed, because inconsistent value for `multi`
 *       multi: false,
 *     },
 *   ],
 * })
 * ```
 */
export class MixedMultiProviderException extends RuntimeException {
  constructor(name: string | symbol) {
    super(MIXED_MULTI_PROVIDER_MESSAGE(name.toString()));
  }
}
