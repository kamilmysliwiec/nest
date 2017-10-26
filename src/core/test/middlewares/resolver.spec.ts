import { expect } from 'chai';
import * as sinon from 'sinon';
import { NestEnvironment } from '../../enums/nest-environment.enum';
import { NestMiddleware } from '../../interfaces/middlewares/nest-middleware.interface';
import { MiddlewaresContainer } from '../../middlewares/container';
import { MiddlewaresResolver } from '../../middlewares/resolver';
import { Logger } from '../../services/logger.service';
import { Component } from '../../utils/decorators/component.decorator';

describe('MiddlewaresResolver', () => {
    @Component()
    class TestMiddleware implements NestMiddleware {
        public resolve() {
            return (req, res, next) => {};
        }
    }

    let resolver: MiddlewaresResolver;
    let container: MiddlewaresContainer;
    let mockContainer: sinon.SinonMock;

    before(() => Logger.setMode(NestEnvironment.TEST));

    beforeEach(() => {
        container = new MiddlewaresContainer();
        resolver = new MiddlewaresResolver(container);
        mockContainer = sinon.mock(container);
    });

    it('should resolve middleware instances from container', () => {
        const loadInstanceOfMiddleware = sinon.stub(resolver['instanceLoader'], 'loadInstanceOfMiddleware');
        const middlewares = new Map();
        const wrapper = {
            instance: { metatype: {} },
            metatype: TestMiddleware
        };
        middlewares.set('TestMiddleware', wrapper);

        const module = <any>{ metatype: { name: '' }};
        mockContainer.expects('getMiddlewares').returns(middlewares);
        resolver.resolveInstances(module, null);

        expect(loadInstanceOfMiddleware.callCount).to.be.equal(middlewares.size);
        expect(loadInstanceOfMiddleware.calledWith(
            wrapper,
            middlewares,
            module
        )).to.be.true;

        loadInstanceOfMiddleware.restore();
    });
});
