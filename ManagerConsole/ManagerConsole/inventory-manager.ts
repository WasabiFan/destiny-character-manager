import _ = require('underscore');

var destiny = require('destiny-client')();
import Bungie = require('./bungie-api/api-core');
import Inventory = require('./bungie-api/api-objects/inventory');
import Configuration = require('./config-manager');
import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import BucketGearCollection = require('./bungie-api/api-objects/bucket-gear-collection');
import Character = require('./bungie-api/api-objects/character');
import ParserUtils = require('./bungie-api/parser-utils');
import Filters = require('./filters');

export class InventoryManager {
    private workingState: InventoryState;
    private lastQueueOperationPromise: Promise<any>;
    private requestCounter: number = 0;

    public loadState(): Promise<any> {
        var workingState = this.workingState = new InventoryState();

        var promises: Promise<any>[] = [];
        Configuration.currentConfig.characters.forEach((currentCharacter, characterIndex) => {
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
            Vault.getItems(Configuration.currentConfig.characters[0]).then(items => {
                this.workingState.vault = new VaultInventoryState();
                var buckets = new BucketGearCollection(items);

                workingState.vault.buckets = this.getBucketStatesFromBuckets(buckets);

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

    private getCharacterFromBuckets(buckets: BucketGearCollection, character: Character.Character): CharacterInventoryState {
        var characterInventory = new CharacterInventoryState();
        characterInventory.character = character;
        characterInventory.buckets = this.getBucketStatesFromBuckets(buckets, character);

        return characterInventory;
    }

    private getBucketStatesFromBuckets(buckets: BucketGearCollection, parent?: Character.Character): { [bucket: number]: InventoryBucketState } {
        var bucketMap = buckets.getBucketMap();
        var result: { [bucket: number]: InventoryBucketState } = {};

        for (var bucketId in bucketMap) {
            var newBucket = new InventoryBucketState();
            newBucket.bucketType = (<Inventory.InventoryBucket>Number(bucketId));
            newBucket.capacity = ParserUtils.findCapacityForBucket(newBucket.bucketType);
            newBucket.parentCharacter = parent;

            for (var gearIndex in bucketMap[bucketId]) {
                newBucket.contents.push(bucketMap[bucketId][gearIndex]);
            }

            result[Number(bucketId)] = newBucket;
        }

        return result;
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
        newOperation.context = new OperationContext();
        newOperation.context.item = item;

        // Get the stack size from the item if it's available
        var stackSize = (<Inventory.StackableItem>item).stackSize || 1;

        // Get all the API params
        newOperation.operationParams = {
            membershipType: Configuration.currentConfig.authMember.type,
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
        newOperation.context = new OperationContext();
        newOperation.context.item = item;

        // Set the operation-specific params
        newOperation.operationParams = {
            membershipType: Configuration.currentConfig.authMember.type,
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
                });
            }

            if (this.lastQueueOperationPromise == undefined || this.lastQueueOperationPromise == null)
                executeAction();
            else
                this.lastQueueOperationPromise.then(executeAction);
        });

        this.lastQueueOperationPromise = newPromise;
    }

    private getDestinyApiPromise(destinyApiFunction, operation: QueuedOperation, retryCounter: number): Promise<any> {
        var promise = new Promise((resolve, reject) => {
            if (retryCounter >= 4) {
                reject(new Error('Operation retry count exceeded on ' + QueuedOperationType[operation.type] + ' on item "' + operation.context.item.name + '" with params ' + JSON.stringify(operation.operationParams, null, 4)));
                return;
            }

            console.log('[Request ' + (++this.requestCounter) + '; retry ' + retryCounter + '] '
                + 'Executing ' + QueuedOperationType[operation.type] + ' operation on item ' + operation.context.item.name);

            if (Configuration.currentConfig.debugMode)
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
                        reject(new Error('API call returned status code ' + res.ErrorStatus));
                }

            }).catch(err => {
                reject(new Error('Error thrown while attempting to call API: ' + err));
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
        var targetCharacter = Configuration.currentConfig.getCharacterFromAlias(characterAlias);

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
            collectionToSearch = Configuration.currentConfig.designatedItems;
        }

        var selectedItems = filter.findMatchesInCollection(collectionToSearch);

        if (filterMode == Filters.FilterMode.Add) {
            Configuration.currentConfig.designatedItems = _.union(Configuration.currentConfig.designatedItems, selectedItems);
        }
        else if (filterMode == Filters.FilterMode.Remove) {
            for (var selIndex in selectedItems) {
                var designatedItemIndex = Filters.FilterUtils.customIndexOf(Configuration.currentConfig.designatedItems,(item) => {
                    return item.instanceId == selectedItems[selIndex].instanceId
                        && item.itemHash == selectedItems[selIndex].itemHash;
                });

                Configuration.currentConfig.designatedItems.splice(designatedItemIndex, 1);
            }
        }
    }
}

export class InventoryState {
    public characters: { [characterId: string]: CharacterInventoryState } = {};
    public vault: VaultInventoryState;
}

export class CharacterInventoryState {
    public buckets: { [bucket: number]: InventoryBucketState } = {};
    public character: Character.Character;
}

export class VaultInventoryState {
    public buckets: { [bucket: number]: InventoryBucketState } = {};
}

export class InventoryBucketState {
    public capacity: number;
    public contents: Inventory.InventoryItem[] = [];
    public bucketType: Inventory.InventoryBucket;

    public parentCharacter: Character.Character;
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
}

export class OperationContext {
    public item: Inventory.InventoryItem;
}