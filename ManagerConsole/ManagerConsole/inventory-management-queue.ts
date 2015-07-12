import Inventory = require('./bungie-api/api-objects/inventory');

export class InventoryManagementQueue {
    public loadState() {
    }

    public getCurrentState(): InventoryState {
    }

    public addMoveToQueue(fromBucket: InventoryBucketState, toBucket: InventoryBucketState, item: Inventory.InventoryItem) {

    }
}

export class InventoryState {
    public characters: CharacterInventoryState[];
    public vault: VaultInventoryState;
}

export class CharacterInventoryState {
    public buckets: InventoryBucketState[];
}

export class VaultInventoryState {
    public buckets: InventoryBucketState[];
}

export class InventoryBucketState {
    public capacity: number;
    public contents: Inventory.InventoryItem[];
}