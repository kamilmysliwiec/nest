import { expect } from 'chai';
import { RequestMethod } from '../../enums/request-method.enum';
import { MiddlewareConfiguration } from '../../interfaces/middlewares/middleware-configuration.interface';
import { NestMiddleware } from '../../interfaces/middlewares/nest-middleware.interface';
import { MiddlewaresContainer } from '../../middlewares/container';
import { Component } from '../../utils/decorators/component.decorator';
import { Controller } from '../../utils/decorators/controller.decorator';
import { RequestMapping } from '../../utils/decorators/request-mapping.decorator';

describe('MiddlewaresContainer', () => {
    @Controller('test')
    class TestRoute {

        @RequestMapping({ path: 'test' })
        public getTest() { }

        @RequestMapping({ path: 'another', method: RequestMethod.DELETE })
        public getAnother() { }
    }

    @Component()
    class TestMiddleware implements NestMiddleware {
        public resolve() {
            return (req, res, next) => { };
        }
    }

    let container: MiddlewaresContainer;

    beforeEach(() => {
        container = new MiddlewaresContainer();
    });

    it('should store expected configurations for given module', () => {
        const config: MiddlewareConfiguration[] = [{
            middlewares: [TestMiddleware],
            forRoutes: [
                TestRoute,
                { path: 'test' },
            ],
        },
        ];
        container.addConfig(config, 'Module' as any);
        expect([...container.getConfigs().get('Module')]).to.deep.equal(config);
    });

    it('should store expected middlewares for given module', () => {
        const config: MiddlewareConfiguration[] = [{
            middlewares: TestMiddleware,
            forRoutes: [TestRoute],
        },
        ];

        const key = 'Test' as any;
        container.addConfig(config, key);
        expect(container.getMiddlewares(key).size).to.eql(config.length);
        expect(container.getMiddlewares(key).get('TestMiddleware')).to.eql({
            instance: null,
            metatype: TestMiddleware,
        });
    });

});
