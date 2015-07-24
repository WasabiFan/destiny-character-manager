import _ = require('underscore');
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
    private lastQueueOperationPromise: Promise<any>;
    private requestCounter: number = 0;

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


    public enqueueMoveOperation(character: CharacterInventoryState, toVault: boolean, item: Inventory.InventoryItem): boolean {

        // Get the two involved buckets by item's bucket type
        var characterBucket = this.workingState.characters[character.character.id].buckets[ParserUtils.getGearBucketForVaultItem(item)];
        var vaultBucket = this.workingState.vault.buckets[ParserUtils.getVaultBucketFromGearBucket(item.bucket)];

        // Figure out which bucket is source and which is target
        var toBucket = toVault ? vaultBucket : characterBucket;
        var fromBucket = toVault ? characterBucket : vaultBucket;

        // Bail if making the move would overflow capacity
        if (toBucket.contents.length + 1 > toBucket.capacity)
            return false;

        // The API will refuse to move an equipped item
        if (item.getIsEquipped() == true)
            return false;

        // Find the index of the target item in the source bucket
        var sourceIndex = null;
        for (var i = 0; i < fromBucket.contents.length; i++) {
            if (fromBucket.contents[i].instanceId == item.instanceId) {
                sourceIndex = i;
                break;
            }
        }

        // Bail if we couldn't find the source item
        if (sourceIndex == null)
            return false;

        // Create the new operation and assign some basic info
        var newOperation: QueuedOperation = new QueuedOperation();
        newOperation.type = QueuedOperationType.MoveItem;
        newOperation.requiresAuth = true;

        // Add special operation context (mostly for debugging)
        newOperation.context = new OperationContext();
        newOperation.context.item = item;
        newOperation.context.loadTrace(1);

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

        // We have queued the request, return a success
        return true;
    }

    public enqueueEquipOperation(character: CharacterInventoryState, item: Inventory.InventoryItem): boolean {
        // If it's in the vault, we can't equip it
        if (ParserUtils.isVault(item.bucket))
            return false;

        // Get the bucket that we're swapping
        var characterBucket = this.workingState.characters[character.character.id].buckets[item.bucket];

        // Find the currently equipped item
        var currentlyEquipped: Inventory.InventoryItem = null;
        for (var i in characterBucket.contents)
            if (characterBucket.contents[i].getIsEquipped() == true)
                currentlyEquipped = characterBucket.contents[i];

        // Find the target item
        var targetItem: Inventory.InventoryItem = null;
        for (var i in characterBucket.contents)
            if (characterBucket.contents[i].instanceId == item.instanceId)
                targetItem = characterBucket.contents[i];

        // If we couldn't find an equipped item, something went horribly wrong
        if (currentlyEquipped == null)
            return false;

        // Create the new operation and set basic config
        var newOperation: QueuedOperation = new QueuedOperation();
        newOperation.type = QueuedOperationType.EquipItem;
        newOperation.requiresAuth = true;

        // Add special operation context (mostly for debugging)
        newOperation.context = new OperationContext();
        newOperation.context.item = item;
        newOperation.context.loadTrace(1);

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

        // We got to the end -- return success
        return true;
    }

    private processQueueAddition(newOperation: QueuedOperation) {
        console.log('Adding operation to queue');
        var newPromise = new Promise((resolve, reject) => {
            var executeAction = () => {
                this.executeQueuedOperation(newOperation).then(() => {
                    setTimeout(() => {
                        this.lastQueueOperationPromise = null;
                        resolve();
                    }, 600);
                }).catch((err) => {
                    reject(err);
                });
            }

            if (_.isUndefined(this.lastQueueOperationPromise) || _.isNull(this.lastQueueOperationPromise))
                executeAction();
            else
                this.lastQueueOperationPromise.then(executeAction).catch(reject);
        });

        this.lastQueueOperationPromise = newPromise;
    }

    private getDestinyApiPromise(destinyApiFunction, operation: QueuedOperation, retryCounter: number): Promise<any> {
        var promise = new Promise((resolve, reject) => {
            if (retryCounter >= 4) {
                reject(new Errors.InventoryQueuedOperationException('Operation retry count exceeded', operation));
                return;
            }

            console.log('[Request ' + (++this.requestCounter) + '; retry ' + retryCounter + '] '
                + 'Executing ' + QueuedOperationType[operation.type] + ' operation on item ' + operation.context.item.name);

            if (DataStores.DataStores.appConfig.currentData.debugMode)
                console.log('Params: ' + JSON.stringify(operation.operationParams, null, 4));

            destinyApiFunction(operation.operationParams, Bungie.getAuthHeaders()).then(res => {
                if (res.ErrorStatus == "Success")
                    resolve();
                else {
                    if (res.ErrorStatus === 'ThrottleLimitExceededMomentarily') {
                        console.log('Throttle limit exceeded; retrying ' + retryCounter);
                        this.getDestinyApiPromise(destinyApiFunction, operation, retryCounter + 1).then(() => {
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

        return this.getDestinyApiPromise(destinyApiFunction, operation, 1);
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

    public applyFilterToDesignatedItems(characterAlias: string, filter: Filters.InventoryFilter, filterMode: Filters.FilterMode) {
        var targetCharacter = DataStores.DataStores.appConfig.currentData.getCharacterFromAlias(characterAlias);

        // If they're removing items, they don't need to specify a character
        if (targetCharacter == null && filterMode == Filters.FilterMode.Add) {
            console.log('Invalid character alias: ' + characterAlias);
            return;
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
    }

    public getCurrentQueueTerminationPromise(): Promise<any> {
        if (_.isNull(this.lastQueueOperationPromise) || _.isUndefined(this.lastQueueOperationPromise))
            return Promise.resolve();

        var promise = new Promise((resolve, reject) => {
            this.lastQueueOperationPromise.then(resolve).catch(reject);
        });

        return promise;
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

    public loadTrace(skipFrames?: number) {
        this.itemSourceTrace = stackTrace.get().slice((skipFrames || 0) + 1);
    }
}