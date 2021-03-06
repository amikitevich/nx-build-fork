"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var effects_1 = require("@ngrx/effects");
var store_1 = require("@ngrx/store");
var of_1 = require("rxjs/observable/of");
var catch_1 = require("rxjs/operator/catch");
var concatMap_1 = require("rxjs/operator/concatMap");
var groupBy_1 = require("rxjs/operator/groupBy");
var mergeMap_1 = require("rxjs/operator/mergeMap");
var switchMap_1 = require("rxjs/operator/switchMap");
var withLatestFrom_1 = require("rxjs/operator/withLatestFrom");
/**
 * @whatItDoes Provides convenience methods for implementing common operations of persisting data.
 */
var DataPersistence = /** @class */ (function () {
    function DataPersistence(store, actions) {
        this.store = store;
        this.actions = actions;
    }
    /**
     *
     * @whatItDoes Handles pessimistic updates (updating the server first).
     *
     * Update the server implemented naively suffers from race conditions and poor error handling.
     *
     * `pessimisticUpdate` addresses these problems--it runs all fetches in order, which removes race conditions
     * and forces the developer to handle errors.
     *
     * ## Example:
     *
     * ```typescript
     * @Injectable()
     * class TodoEffects {
     *   @Effect() updateTodo = this.s.pessimisticUpdate<UpdateTodo>('UPDATE_TODO', {
     *     // provides an action and the current state of the store
     *     run(a, state) {
     *       // update the backend first, and then dispatch an action that will
     *       // update the client side
     *       return this.backend(state.user, a.payload).map(updated => ({
     *         type: 'TODO_UPDATED',
     *         payload: updated
     *       }));
     *     },
     *
     *     onError(a, e: any) {
     *       // we don't need to undo the changes on the client side.
     *       // we can dispatch an error, or simply log the error here and return `null`
     *       return null;
     *     }
     *   });
     *
     *   constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
     * }
     * ```
     */
    DataPersistence.prototype.pessimisticUpdate = function (actionType, opts) {
        var nav = this.actions.ofType(actionType);
        var pairs = withLatestFrom_1.withLatestFrom.call(nav, this.store);
        return concatMap_1.concatMap.call(pairs, this.runWithErrorHandling(opts.run, opts.onError));
    };
    /**
     *
     * @whatItDoes Handles optimistic updates (updating the client first).
     *
     * `optimisticUpdate` addresses these problems--it runs all fetches in order, which removes race conditions
     * and forces the developer to handle errors.
     *
     * `optimisticUpdate` is different from `pessimisticUpdate`. In case of a failure, when using `optimisticUpdate`,
     * the developer already updated the state locally, so the developer must provide an undo action.
     *
     * The error handling must be done in the callback, or by means of the undo action.
     *
     * ## Example:
     *
     * ```typescript
     * @Injectable()
     * class TodoEffects {
     *   @Effect() updateTodo = this.s.optimisticUpdate<UpdateTodo>('UPDATE_TODO', {
     *     // provides an action and the current state of the store
     *     run: (a, state) => {
     *       return this.backend(state.user, a.payload);
     *     },
     *
     *     undoAction: (a, e: any) => {
     *       // dispatch an undo action to undo the changes in the client state
     *       return ({
     *         type: 'UNDO_UPDATE_TODO',
     *         payload: a
     *       });
     *     }
     *   });
     *
     *   constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
     * }
     * ```
     */
    DataPersistence.prototype.optimisticUpdate = function (actionType, opts) {
        var nav = this.actions.ofType(actionType);
        var pairs = withLatestFrom_1.withLatestFrom.call(nav, this.store);
        return concatMap_1.concatMap.call(pairs, this.runWithErrorHandling(opts.run, opts.undoAction));
    };
    /**
     *
     * @whatItDoes Handles data fetching.
     *
     * Data fetching implemented naively suffers from race conditions and poor error handling.
     *
     * `fetch` addresses these problems--it runs all fetches in order, which removes race conditions
     * and forces the developer to handle errors.
     *
     * ## Example:
     *
     * ```typescript
     * @Injectable()
     * class TodoEffects {
     *   @Effect() loadTodos = this.s.fetch<GetTodos>('GET_TODOS', {
     *     // provides an action and the current state of the store
     *     run: (a, state) => {
     *       return this.backend(state.user, a.payload).map(r => ({
     *         type: 'TODOS',
     *         payload: r
     *       });
     *     },
     *
     *     onError: (a, e: any) => {
     *       // dispatch an undo action to undo the changes in the client state
     *     }
     *   });
     *
     *   constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
     * }
     * ```
     *
     * This is correct, but because it set the concurrency to 1, it may not be performant.
     *
     * To fix that, you can provide the `id` function, li ke this:
     *
     * ```typescript
     * @Injectable()
     * class TodoEffects {
     *   @Effect() loadTodo = this.s.fetch<GetTodo>('GET_TODO', {
     *     id: (a, state) => {
     *       return a.payload.id;
     *     }
     *
     *     // provides an action and the current state of the store
     *     run: (a, state) => {
     *       return this.backend(state.user, a.payload).map(r => ({
     *         type: 'TODO',
     *         payload: r
     *       });
     *     },
     *
     *     onError: (a, e: any) => {
     *       // dispatch an undo action to undo the changes in the client state
     *       return null;
     *     }
     *   });
     *
     *   constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
     * }
     * ```
     *
     * With this setup, the requests for Todo 1 will run concurrently with the requests for Todo 2.
     *
     * In addition, if DataPersistence notices that there are multiple requests for Todo 1 scheduled,
     * it will only run the last one.
     */
    DataPersistence.prototype.fetch = function (actionType, opts) {
        var _this = this;
        var nav = this.actions.ofType(actionType);
        var allPairs = withLatestFrom_1.withLatestFrom.call(nav, this.store);
        if (opts.id) {
            var groupedFetches = groupBy_1.groupBy.call(allPairs, function (p) { return opts.id(p[0], p[1]); });
            return mergeMap_1.mergeMap.call(groupedFetches, function (pairs) {
                return switchMap_1.switchMap.call(pairs, _this.runWithErrorHandling(opts.run, opts.onError));
            });
        }
        else {
            return concatMap_1.concatMap.call(allPairs, this.runWithErrorHandling(opts.run, opts.onError));
        }
    };
    DataPersistence.prototype.runWithErrorHandling = function (run, onError) {
        return function (a) {
            try {
                var r = wrapIntoObservable(run(a[0], a[1]));
                return catch_1._catch.call(r, function (e) { return wrapIntoObservable(onError(a[0], e)); });
            }
            catch (e) {
                return wrapIntoObservable(onError(a[0], e));
            }
        };
    };
    DataPersistence = __decorate([
        core_1.Injectable(),
        __metadata("design:paramtypes", [store_1.Store, effects_1.Actions])
    ], DataPersistence);
    return DataPersistence;
}());
exports.DataPersistence = DataPersistence;
function wrapIntoObservable(obj) {
    if (!!obj && typeof obj.subscribe === 'function') {
        return obj;
    }
    else if (!obj) {
        return of_1.of();
    }
    else {
        return of_1.of(obj);
    }
}
