import { Metatype } from '/interfaces/metatype.interface';
import { GatewayMiddleware } from './gateway-middleware.interface';

export interface GatewayMetadata {
    port?: number;
    namespace?: string;
    middlewares?: Metatype<GatewayMiddleware>[];
}
