﻿import _ = require('underscore');
import stackTrace = require('stack-trace');
var destiny = require('destiny-client')();

// Bungie API
import Inventory = require('../bungie-api/api-objects/inventory');
import Character = require('../bungie-api/api-objects/character');
import GearCollection = require('../bungie-api/api-objects/bucket-gear-collection');
import Bungie = require('../bungie-api/api-core');
import Vault = require('../bungie-api/vault-api');
import Gear = require('../bungie-api/gear-api');
import ParserUtils = require('../bungie-api/parser-utils');

// Utils
import DataStores = require('../utils/data-stores');
import Errors = require('../utils/errors');

// App core
import Filters = require('../app-core/filters');

export class InventoryManager {
    private workingState: InventoryState;
    private lastRegisteredQueueOperation: QueuedOperation;
    private lastExecutedQueueOperation: QueuedOperation;
    private requestCounter: number = 0;

    private timeoutBetweenRequests = 1000 * 1.1;

    public loadState(): Promise<any> {
        if (!DataStores.DataStores.appConfig.currentData.hasFullAuthInfo)
            return Promise.reject(new Errors.Exception('Full authentication info must be available in the application config before loading data.', Errors.ExceptionCode.InsufficientAuthConfig));

        var workingState = this.workingState = new InventoryState();

        var promises: Promise<any>[] = [];
        DataStores.DataStores.appConfig.currentData.characters.forEach((currentCharacter, characterIndex) => {
            var promise = new Promise((resolve, reject) => {
                // TODO: inventory
                Gear.getItems(currentCharacter).then(buckets => {
                    workingState.characters[currentCharacter.id] = this.getCharacterFromBuckets(buckets, currentCharacter);

                    resolve();
                }).catch((error) => {
                    reject(error);
                });
            });
            promises.push(promise);
        });

        var vaultPromise = new Promise((resolve, reject) => {
            // TODO: If there are no characters, this next line will break
            Vault.getItems(DataStores.DataStores.appConfig.currentData.characters[0]).then(items => {
                this.workingState.vault = new VaultInventoryState();
                var buckets = new GearCollection.BucketGearCollection(items);

                workingState.vault.bucketCollection = buckets;

                resolve();
            }).catch((error) => {
                reject(error);
            });
        });

        promises.push(vaultPromise);

        return Promise.all(promises);
    }

    public get currentState(): InventoryState {
        return this.workingState;
    }

    public get isLoaded(): boolean {
        return this.workingState != undefined;
    }

    private getCharacterFromBuckets(buckets: GearCollection.BucketGearCollection, character: Character.Character): CharacterInventoryState {
        var characterInventory = new CharacterInventoryState();
        characterInventory.character = character;
        characterInventory.bucketCollection = buckets;

        return characterInventory;
    }


    public enqueueMoveOperation(character: CharacterInventoryState, toVault: boolean, item: Inventory.InventoryItem) {
        this.workingState.characters[character.character.id].bucketCollection.createBucket(ParserUtils.getGearBucketForVaultItem(item));
        character = this.workingState.characters[character.character.id];

        // Get the two involved buckets by item's bucket type
        var characterBucket = this.workingState.characters[character.character.id].buckets[ParserUtils.getGearBucketForVaultItem(item)];
        var vaultBucket = this.workingState.vault.buckets[ParserUtils.getVaultBucketFromGearBucket(item.bucket)];

        // Figure out which bucket is source and which is target
        var toBucket = toVault ? vaultBucket : characterBucket;
        var fromBucket = toVault ? characterBucket : vaultBucket;

        // Bail if making the move would overflow capacity
        if (toBucket.contents.length + 1 > toBucket.capacity)
            throw new Errors.Exception('The requested move operation would overflow the target\'s capacity.', Errors.ExceptionCode.InvalidInventoryOperation);

        // The API will refuse to move an equipped item
        if (item.getIsEquipped() == true)
            throw new Errors.Exception('The requested item is currently equipped and cannot be moved.', Errors.ExceptionCode.InvalidInventoryOperation);

        // Find the index of the target item in the source bucket
        var sourceIndex = null;
        for (var i = 0; i < fromBucket.contents.length; i++) {
            if (fromBucket.contents[i].instanceId == item.instanceId && fromBucket.contents[i].itemHash == item.itemHash) {
                sourceIndex = i;
                break;
            }
        }

        // Bail if we couldn't find the source item
        if (sourceIndex == null)
            throw new Errors.Exception('The requested item could not be found in the source bucket.', Errors.ExceptionCode.InvalidInventoryOperation);

        // Create the new operation and assign some basic info
        var newOperation: QueuedOperation = new QueuedOperation();
        newOperation.type = QueuedOperationType.MoveItem;
        newOperation.requiresAuth = true;

        // Add special operation context (mostly for debugging)
        newOperation.context = new OperationContext(item);

        // Get the stack size from the item if it's available
        var stackSize = (<Inventory.StackableItem>item).stackSize || 1;
        
        // Get all the API params
        newOperation.operationParams = {
            membershipType: DataStores.DataStores.appConfig.currentData.authMember.type,
            characterId: character.character.id,
            itemId: item.instanceId,
            itemReferenceHash: item.itemHash,
            stackSize: stackSize,
            transferToVault: toVault
        };

        // Register this operation to happen after the previous one completes
        this.processQueueAddition(newOperation);

        // Update the local working state to reflect the change
        var itemFromSource = fromBucket.contents.splice(sourceIndex, 1)[0];
        if (toVault)
            itemFromSource.bucket = ParserUtils.getVaultBucketFromGearBucket(itemFromSource.bucket);
        else
            itemFromSource.bucket = ParserUtils.getGearBucketForVaultItem(itemFromSource);
        toBucket.contents.push(itemFromSource);
    }

    public enqueueEquipOperation(character: CharacterInventoryState, item: Inventory.InventoryItem) {
        // If it's in the vault, we can't equip it
        if (ParserUtils.isVaultBucket(item.bucket) || ParserUtils.isInventoryBucket(item.bucket))
            throw new Errors.Exception('The requested item is currently in the vault or a character\'s material inventory and cannot be equipped.', Errors.ExceptionCode.InvalidInventoryOperation);

        // Get the bucket that we're swapping
        var characterBucket = this.workingState.characters[character.character.id].buckets[item.bucket];

        // Find the currently equipped item
        var currentlyEquipped: Inventory.InventoryItem = null;
        for (var i in characterBucket.contents)
            if (characterBucket.contents[i].getIsEquipped() == true)
                currentlyEquipped = characterBucket.contents[i];

        // If we couldn't find an equipped item, something went horribly wrong
        if (currentlyEquipped == null)
            throw new Errors.Exception('We were unable to find the item that must be unequipped for this operation to continue.', Errors.ExceptionCode.InvalidInventoryOperation);

        // Find the target item
        var targetItem: Inventory.InventoryItem = null;
        for (var i in characterBucket.contents)
            if (characterBucket.contents[i].instanceId == item.instanceId && characterBucket.contents[i].itemHash == item.itemHash)
                targetItem = characterBucket.contents[i];

        // Create the new operation and set basic config
        var newOperation: QueuedOperation = new QueuedOperation();
        newOperation.type = QueuedOperationType.EquipItem;
        newOperation.requiresAuth = true;

        // Add special operation context (mostly for debugging)
        newOperation.context = new OperationContext(item);

        // Set the operation-specific params
        newOperation.operationParams = {
            membershipType: DataStores.DataStores.appConfig.currentData.authMember.type,
            characterId: character.character.id,
            itemId: item.instanceId
        };

        // Register the new operation to happen after the previous one completes
        this.processQueueAddition(newOperation);

        // Swap the equipped weapon in the working state
        (<Inventory.GearItem>currentlyEquipped).isEquipped = false;
        (<Inventory.GearItem>targetItem).isEquipped = true;
    }

    private processQueueAddition(newOperation: QueuedOperation) {
        console.log('Adding operation to queue');
        var newPromise = new Promise((resolve, reject) => {
            var executeAction = () => {
                this.executeQueuedOperation(newOperation).then(() => {
                    resolve();
                }).catch((err) => {
                    reject(err);
                });
            }

            if (_.isUndefined(this.lastRegisteredQueueOperation) || _.isNull(this.lastRegisteredQueueOperation))
                executeAction();
            else
                this.lastRegisteredQueueOperation.context.registerCancellable(executeAction, reject);
        });

        newOperation.context.executionPromise = newPromise;
        this.lastRegisteredQueueOperation = newOperation;
    }

    private runDestinyApiRequest(destinyApiFunction, operation: QueuedOperation, retryCounter: number): Promise<any> {
        var promise = new Promise((resolve, reject) => {

            var timeUntilNextIncrement = 0;
            if (!_.isUndefined(this.lastExecutedQueueOperation) && !_.isNull(this.lastExecutedQueueOperation) && !_.isUndefined(this.lastExecutedQueueOperation.context.startTime) && !_.isNull(this.lastExecutedQueueOperation.context.startTime))
                timeUntilNextIncrement = Math.max(0, this.timeoutBetweenRequests - (Date.now() - this.lastExecutedQueueOperation.context.startTime.getTime()));

            setTimeout(() => {

                console.log('[Request ' + (++this.requestCounter) + (retryCounter > 1 ? ('; retry ' + (retryCounter - 1)) : '') + '] '
                    + 'Executing ' + QueuedOperationType[operation.type] + ' operation on item ' + operation.context.item.name);

                if (DataStores.DataStores.appConfig.currentData.debugMode)
                    console.log('Params: ' + JSON.stringify(operation.operationParams, null, 4));

                operation.context.startTime = new Date();
                this.lastExecutedQueueOperation = operation;
                destinyApiFunction(operation.operationParams, Bungie.getAuthHeaders()).then(res => {
                    if (res.ErrorStatus == "Success") {
                        resolve();
                    }
                    else {
                        if (res.ErrorStatus === 'ThrottleLimitExceededMomentarily') {
                            if (retryCounter >= 4) {
                                reject(new Errors.InventoryQueuedOperationException('Operation retry count exceeded', operation));
                                return;
                            }

                            console.log('Throttle limit exceeded; retrying ' + retryCounter);
                            this.runDestinyApiRequest(destinyApiFunction, operation, retryCounter + 1).then(() => {
                                resolve();
                            }).catch(error => {
                                reject(error);
                            });
                        }
                        else
                            reject(new Errors.InventoryQueuedOperationException('API call returned status code ' + res.ErrorStatus, operation));
                    }

                }).catch(err => {
                    reject(new Errors.InventoryQueuedOperationException('Error thrown while attempting to call API', operation, err));
                })
            }, timeUntilNextIncrement);
        });

        return promise;
    }

    private executeQueuedOperation(operation: QueuedOperation): Promise<any> {
        var destinyApiFunction: (opts: any, auth?: any) => Promise<any>;

        switch (operation.type) {
            case QueuedOperationType.MoveItem:
                destinyApiFunction = (<(opts: any, auth: any) => Promise<any>>destiny.TransferItem);
                break;
            case QueuedOperationType.EquipItem:
                destinyApiFunction = (<(opts: any, auth: any) => Promise<any>>destiny.Equip);
                break;
        }

        return this.runDestinyApiRequest(destinyApiFunction, operation, 1);
    }

    public getAllCharacterItems(targetCharacter: Character.Character): Inventory.InventoryItem[] {
        var result: Inventory.InventoryItem[] = [];

        var inventoryBuckets = this.workingState.characters[targetCharacter.id].buckets;
        for (var bucketIndex in inventoryBuckets) {
            result.push.apply(result, inventoryBuckets[bucketIndex].contents);
        }

        return result;
    }

    public getAllVaultItems(): Inventory.InventoryItem[] {
        var result: Inventory.InventoryItem[] = [];

        var inventoryBuckets = this.workingState.vault.buckets;
        for (var bucketIndex in inventoryBuckets) {
            result.push.apply(result, inventoryBuckets[bucketIndex].contents);
        }

        return result;
    }

    public applyFilterToDesignatedItems(characterAlias: string, filter: Filters.InventoryFilter, filterMode: Filters.FilterMode): Inventory.InventoryItem[] {
        var targetCharacter = DataStores.DataStores.appConfig.currentData.getCharacterFromAlias(characterAlias);

        // If they're removing items, they don't need to specify a character
        if (targetCharacter == null && filterMode == Filters.FilterMode.Add) {
            throw new Errors.Exception('Invalid source alias: ' + characterAlias, Errors.ExceptionCode.InvalidCommandParams);
        }

        var collectionToSearch: Inventory.InventoryItem[] = [];
        if (filterMode == Filters.FilterMode.Add) {
            collectionToSearch = this.getAllCharacterItems(targetCharacter);
        }
        else if (filterMode == Filters.FilterMode.Remove) {
            collectionToSearch = DataStores.DataStores.appConfig.currentData.designatedItems;
        }

        var selectedItems = filter.findMatchesInCollection(collectionToSearch);

        if (filterMode == Filters.FilterMode.Add) {
            DataStores.DataStores.appConfig.currentData.designatedItems = _.union(DataStores.DataStores.appConfig.currentData.designatedItems, selectedItems);
        }
        else if (filterMode == Filters.FilterMode.Remove) {
            for (var selIndex in selectedItems) {
                var designatedItemIndex = Filters.FilterUtils.customIndexOf(DataStores.DataStores.appConfig.currentData.designatedItems, (item) => {
                    return item.instanceId == selectedItems[selIndex].instanceId
                        && item.itemHash == selectedItems[selIndex].itemHash;
                });

                DataStores.DataStores.appConfig.currentData.designatedItems.splice(designatedItemIndex, 1);
            }
        }

        return selectedItems;
    }

    public getCurrentQueueTerminationPromise(): Promise<any> {
        if (_.isNull(this.lastRegisteredQueueOperation) || _.isUndefined(this.lastRegisteredQueueOperation))
            return Promise.resolve();

        var promise = new Promise((resolve, reject) => {
            this.lastRegisteredQueueOperation.context.executionPromise.then(resolve).catch(reject);
        });

        return promise;
    }

    public clearQueue() {
        // NOTE: This won't actually stop the waiting promises

        if (this.lastRegisteredQueueOperation)
            this.lastRegisteredQueueOperation.context.cancelChain();

        if (this.lastExecutedQueueOperation)
            this.lastExecutedQueueOperation.context.cancelChain();

        this.lastRegisteredQueueOperation = null;
        this.lastExecutedQueueOperation = null;
    }
}

export class InventoryState {
    public characters: { [characterId: string]: CharacterInventoryState } = {};
    public vault: VaultInventoryState;
}

export class CharacterInventoryState {
    public get buckets(): { [bucket: number]: GearCollection.InventoryBucketState } {
        if (_.isUndefined(this.bucketCollection))
            return undefined;

        return this.bucketCollection.getBucketMap();
    }

    public bucketCollection: GearCollection.BucketGearCollection;
    public character: Character.Character;
}

export class VaultInventoryState {
    public get buckets(): { [bucket: number]: GearCollection.InventoryBucketState } {
        if (_.isUndefined(this.bucketCollection))
            return undefined;

        return this.bucketCollection.getBucketMap();
    }

    public bucketCollection: GearCollection.BucketGearCollection;
}

export enum QueuedOperationType {
    MoveItem,
    EquipItem
}

export class QueuedOperation {
    public type: QueuedOperationType;
    public requiresAuth: boolean;
    public operationParams: any;
    public context: OperationContext;

    public toString(numIndents?: number): string {
        var coreStr = QueuedOperationType[this.type] + '[' + this.context.item.name + ']: ';
        var stackStr = Errors.ErrorUtils.stringifyStack(this.context.itemSourceTrace, 1);
        return Errors.ErrorUtils.increaseIndentation(coreStr + '\r\n' + stackStr, numIndents);
    }
}

export class OperationContext {
    public item: Inventory.InventoryItem;
    public itemSourceTrace: stackTrace.StackFrame[] = [];
    public startTime: Date;
    public executionPromise: Promise<any>;
    
    private shouldCancel = false;

    constructor(item: Inventory.InventoryItem) {
        this.item = item;

        this.loadTrace(2);
    }

    public loadTrace(skipFrames?: number) {
        this.itemSourceTrace = stackTrace.get().slice((skipFrames || 0) + 1);
    }

    public cancelChain() {
        this.shouldCancel = true;
    }

    public registerCancellable(onResolve: (value?) => void, onReject?: (err?) => void) {
        this.executionPromise.then((value?) => {
            if (!this.shouldCancel)
                onResolve(value);
        });

        if (!_.isUndefined(onReject)) {
            this.executionPromise.catch((err?) => {
                if (!this.shouldCancel)
                    onReject(err);
            });
        }
    }
}