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
                    workingState.characters.push(this.getCharacterFromBuckets(buckets, Configuration.currentConfig.characters[characterIndex]));
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

    public enqueueMoveOperation(character: CharacterInventoryState, toVault: boolean, item: Inventory.InventoryItem) {
        var newOperation: QueuedOperation = new QueuedOperation();
        newOperation.type = QueuedOperationType.MoveItem;
        newOperation.requiresAuth = true;

        var stackSize = (<Inventory.StackableItem>item).stackSize || 1;

        newOperation.operationParams = {
            membershipType: Configuration.currentConfig.authMember.type,
            characterId: character.character.id,
            itemId: item.instanceId,
            itemReferenceHash: item.itemHash,
            stackSize: stackSize,
            transferToVault: toVault
        };

        this.operationQueue.push(newOperation);
        this.processQueueAddition(newOperation);
    }

    public enqueueEquipOperation(character: CharacterInventoryState, item: Inventory.InventoryItem) {
        var newOperation: QueuedOperation = new QueuedOperation();
        newOperation.type = QueuedOperationType.EquipItem;
        newOperation.requiresAuth = true;

        newOperation.operationParams = {
            membershipType: Configuration.currentConfig.authMember.type,
            characterId: character.character.id,
            itemId: item.instanceId
        };

        this.operationQueue.push(newOperation);
        this.processQueueAddition(newOperation);
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
    public characters: CharacterInventoryState[] = [];
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