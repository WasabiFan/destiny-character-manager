var destiny = require('destiny-client');
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
    private operationQueue: QueuedOperation[];
    private lastQueueOperationPromise: Promise<any>;

    public loadState(): Promise<any> {
        this.workingState = new InventoryState();

        var promises: Promise<any>[] = [];
        for (var characterIndex in Configuration.currentConfig.characters) {
            var promise = new Promise((resolve, reject) => {
                // TODO: inventory
                Gear.getItems(Configuration.currentConfig.characters[characterIndex]).then(buckets => {
                    this.workingState.characters.push(this.getCharacterFromBuckets(buckets, Configuration.currentConfig.characters[characterIndex]));
                    resolve();
                });
            });
            promises.push(promise);
        }

        var vaultPromise = new Promise((resolve, reject) => {
            Vault.getItems(Configuration.currentConfig.characters[0]).then(items => {
                this.workingState.vault = new VaultInventoryState();
                var buckets = new BucketGearCollection(items);

                this.workingState.vault.buckets = this.getBucketStatesFromBuckets(buckets);

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

    private getBucketStatesFromBuckets(buckets: BucketGearCollection, parent?: Character.Character): InventoryBucketState[] {
        var bucketMap = buckets.getBucketMap();
        var result: InventoryBucketState[] = [];

        for (var bucketId in bucketMap) {
            var newBucket = new InventoryBucketState();
            newBucket.bucketType = (<Inventory.InventoryBucket>bucketId);
            newBucket.capacity = ParserUtils.findCapacityForBucket(newBucket.bucketType);
            newBucket.parentCharacter = parent;

            for (var gearIndex in bucketMap[bucketId]) {
                newBucket.contents.push(bucketMap[bucketId][gearIndex]);
            }

            result.push(newBucket);
        }

        return result;
    }

    public getCurrentState(): InventoryState {
        return this.workingState;
    }

    public addMoveOperationToQueue(fromBucket: InventoryBucketState, toBucket: InventoryBucketState, item: Inventory.InventoryItem) {
        var newOperation: QueuedOperation = new QueuedOperation();
        newOperation.type = QueuedOperationType.MoveItem;
        newOperation.requiresAuth = true;

        var currentCharacter = fromBucket.parentCharacter || toBucket.parentCharacter;
        var stackSize = (<Inventory.StackableItem>item).stackSize || 1;

        newOperation.operationParams = {
            membershipType: Configuration.currentConfig.authMember.type,
            characterId: currentCharacter.id,
            itemId: item.instanceId,
            itemReferenceHash: item.itemHash,
            stackSize: stackSize,
            transferToVault: ParserUtils.isVault(toBucket.bucketType)
        };

        this.operationQueue.push(newOperation);
        this.processQueueAddition(newOperation);
    }

    private processQueueAddition(newOperation: QueuedOperation) {
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
    }

    private executeQueuedOperation(operation: QueuedOperation): Promise<any> {
        var destinyApiFunction: (opts: any, auth?: any) => Promise<any>;

        switch (operation.type) {
            case QueuedOperationType.MoveItem:
                destinyApiFunction = (<(opts: any, auth: any) => Promise<any>>destiny.TransferItem);
                break;
        }

        var args = [operation.operationParams];
        if (operation.requiresAuth)
            args.push(Bungie.getAuthHeaders());

        return destinyApiFunction.apply(destiny, args);
    }
}

export class InventoryState {
    public characters: CharacterInventoryState[] = [];
    public vault: VaultInventoryState;
}

export class CharacterInventoryState {
    public buckets: InventoryBucketState[] = [];
    public character: Character.Character;
}

export class VaultInventoryState {
    public buckets: InventoryBucketState[] = [];
}

export class InventoryBucketState {
    public capacity: number;
    public contents: Inventory.InventoryItem[] = [];
    public bucketType: Inventory.InventoryBucket;

    public parentCharacter: Character.Character;
}

export enum QueuedOperationType {
    MoveItem
}

export class QueuedOperation {
    public type: QueuedOperationType;
    public requiresAuth: boolean;
    public operationParams: any;
}