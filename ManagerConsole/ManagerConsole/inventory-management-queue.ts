var destiny = require('destiny-client')();
import Bungie = require('./bungie-api/api-core');
import Inventory = require('./bungie-api/api-objects/inventory');
import Configuration = require('./config-manager');
import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import BucketGearCollection = require('./bungie-api/api-objects/bucket-gear-collection');
import Character = require('./bungie-api/api-objects/character');
import ParserUtils = require('./bungie-api/parser-utils');

export class InventoryManagementQueue {
    private workingState: InventoryState;
    private operationQueue: QueuedOperation[] = [];
    private lastQueueOperationPromise: Promise<any>;

    public loadState(): Promise<any> {
        var workingState = this.workingState = new InventoryState();

        var promises: Promise<any>[] = [];
        for (var characterIndex in Configuration.currentConfig.characters) {
            var promise = new Promise((resolve, reject) => {
                // TODO: inventory
                Gear.getItems(Configuration.currentConfig.characters[characterIndex]).then(buckets => {
                    var currentCharacterData = Configuration.currentConfig.characters[characterIndex];
                    workingState.characters[currentCharacterData.id] = this.getCharacterFromBuckets(buckets, currentCharacterData);

                    resolve();
                });
            });
            promises.push(promise);
        }

        var vaultPromise = new Promise((resolve, reject) => {
            Vault.getItems(Configuration.currentConfig.characters[0]).then(items => {
                this.workingState.vault = new VaultInventoryState();
                var buckets = new BucketGearCollection(items);

                workingState.vault.buckets = this.getBucketStatesFromBuckets(buckets);

                resolve();
            });
        });

        promises.push(vaultPromise);

        return Promise.all(promises);
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

    public getCurrentState(): InventoryState {
        return this.workingState;
    }

    public enqueueMoveOperation(character: CharacterInventoryState, toVault: boolean, item: Inventory.InventoryItem): boolean {

        // Get the two involved buckets by item's bucket type
        var characterBucket = this.workingState.characters[character.character.id].buckets[item.bucket];
        var vaultBucket = this.workingState.vault.buckets[item.bucket];

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
            if (fromBucket.contents[sourceIndex].instanceId == item.instanceId) {
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

        // Push the operation to the queue (currently unused)
        this.operationQueue.push(newOperation);

        // Register this operation to happen after the previous one completes
        this.processQueueAddition(newOperation);

        // Update the local working state to reflect the change
        toBucket.contents.push(fromBucket.contents.splice(sourceIndex, 1)[0]);

        // We have queued the request, return a success
        return true;
    }

    public enqueueEquipOperation(character: CharacterInventoryState, item: Inventory.InventoryItem): boolean {
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

        // Set the operation-specific params
        newOperation.operationParams = {
            membershipType: Configuration.currentConfig.authMember.type,
            characterId: character.character.id,
            itemId: item.instanceId
        };

        // Push new operation to the queue (currently unused)
        this.operationQueue.push(newOperation);

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
                    resolve();
                });
            }

            if (this.lastQueueOperationPromise == undefined)
                executeAction();
            else
                this.lastQueueOperationPromise.then(executeAction);
        });

        this.lastQueueOperationPromise = newPromise;
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

        console.log('Executing operation "' + operation.type.toString() + '" with params: ' + JSON.stringify(operation.operationParams, null, 4)); 

        return destinyApiFunction(operation.operationParams, Bungie.getAuthHeaders());

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
}