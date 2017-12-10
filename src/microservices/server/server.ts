import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/finally';
import 'rxjs/add/observable/empty';
import 'rxjs/add/observable/of';
import 'rxjs/add/observable/fromPromise';

import { Logger } from '@nestjs/common/services/logger.service';
import { MessageHandlers } from '../interfaces/message-handlers.interface';
import { MicroserviceResponse } from '../index';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

export abstract class Server {
    protected readonly messageHandlers: MessageHandlers = {};
    protected readonly logger = new Logger(Server.name);

    public getHandlers(): MessageHandlers {
        return this.messageHandlers;
    }

    public add(pattern: string, callback: (data: any) => Promise<Observable<any>>) {
        this.messageHandlers[JSON.stringify(pattern)] = callback;
    }

    public send(stream$: Observable<any>, respond: (data: MicroserviceResponse) => void): Subscription {
        return stream$.catch((err) => {
            respond({ err, response: null });
            return Observable.empty();
        })
            .finally(() => respond({ disposed: true }))
            .subscribe((response) => respond({ err: null, response }));
    }

    public transformToObservable<T>(resultOrDeffered: Promise<T> | Observable<T>): Observable<T> {
        if (resultOrDeffered instanceof Promise) {
            return Observable.fromPromise(resultOrDeffered);
        }
        else if (!(resultOrDeffered instanceof Observable)) {
            return Observable.of(resultOrDeffered);
        }
        return resultOrDeffered;
    }

    protected handleError(error: string) {
        this.logger.error(error);
    }
}
