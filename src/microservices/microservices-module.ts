import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception';
import { GuardsConsumer } from '@nestjs/core/guards/guards-consumer';
import { GuardsContextCreator } from '@nestjs/core/guards/guards-context-creator';
import { InstanceWrapper } from '@nestjs/core/injector/container';
import { InterceptorsConsumer } from '@nestjs/core/interceptors/interceptors-consumer';
import { InterceptorsContextCreator } from '@nestjs/core/interceptors/interceptors-context-creator';
import { Controller } from '@nestjs/core/interfaces/controllers/controller.interface';
import { PipesConsumer } from '@nestjs/core/pipes/pipes-consumer';
import { PipesContextCreator } from '@nestjs/core/pipes/pipes-context-creator';
import { ClientsContainer } from './container';
import { ExceptionFiltersContext } from './context/exception-filters-context';
import { RpcContextCreator } from './context/rpc-context-creator';
import { RpcProxy } from './context/rpc-proxy';
import { CustomTransportStrategy } from './interfaces';
import { ListenersController } from './listeners-controller';
import { Server } from './server/server';

export class MicroservicesModule {
    private static readonly clientsContainer = new ClientsContainer();
    private static listenersController: ListenersController;

    public static setup(container, config) {
        const contextCreator = new RpcContextCreator(
            new RpcProxy(),
            new ExceptionFiltersContext(config),
            new PipesContextCreator(config),
            new PipesConsumer(),
            new GuardsContextCreator(container, config),
            new GuardsConsumer(),
            new InterceptorsContextCreator(container, config),
            new InterceptorsConsumer(),
        );
        this.listenersController = new ListenersController(
            MicroservicesModule.clientsContainer,
            contextCreator,
        );
    }

    public static setupListeners(container, server: Server & CustomTransportStrategy) {
        if (!this.listenersController) {
            throw new RuntimeException();
        }
        const modules = container.getModules();
        modules.forEach(({ routes }, module) => this.bindListeners(routes, server, module));
    }

    public static setupClients(container) {
        if (!this.listenersController) {
            throw new RuntimeException();
        }
        const modules = container.getModules();
        modules.forEach(({ routes, components }) => {
            this.bindClients(routes);
            this.bindClients(components);
        });
    }

    public static bindListeners(
        controllers: Map<string, InstanceWrapper<Controller>>,
        server: Server & CustomTransportStrategy,
        module: string) {

        controllers.forEach(({ instance }) => {
            this.listenersController.bindPatternHandlers(instance, server, module);
        });
    }

    public static bindClients(controllers: Map<string, InstanceWrapper<Controller>>) {
        controllers.forEach(({ instance, isNotMetatype }) => {
            !isNotMetatype && this.listenersController.bindClientsToProperties(instance);
        });
    }

    public static close() {
        const clients = this.clientsContainer.getAllClients();
        clients.forEach((client) => client.close());
        this.clientsContainer.clear();
    }
}
