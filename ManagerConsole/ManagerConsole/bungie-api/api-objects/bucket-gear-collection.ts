import Inventory = require('./inventory');

class BucketGearCollection {

    private bucketMap: { [bucket: number]: Inventory.InventoryItem[] } = {};

    constructor(items?: Inventory.InventoryItem[]) {
        if (items != undefined) {
            for (var i in items)
                this.addItem(items[i]);
        }
    }

    public addItem(item: Inventory.InventoryItem) {
        this.createBucket(item.bucket);
        this.bucketMap[item.bucket].push(item);
    }

    public getItems(bucket: Inventory.InventoryBucket): Inventory.InventoryItem[]{
        return this.bucketMap[bucket] || [];
    }

    public getEquippedItem(bucket: Inventory.InventoryBucket): Inventory.InventoryItem {
        for (var i in this.bucketMap[bucket])
            if (this.bucketMap[bucket][i] instanceof Inventory.GearItem && (<Inventory.GearItem>this.bucketMap[bucket][i]).isEquipped)
                return this.bucketMap[bucket][i];

        return null;
    }

    public getAllItems(): Inventory.InventoryItem[]{
        var result: Inventory.InventoryItem[] = [];
        for (var bucket in this.bucketMap) {
            result = result.concat(this.bucketMap[bucket]);
        }

        return result;
    }

    private createBucket(bucket: Inventory.InventoryBucket) {
        if (!(this.bucketMap[bucket] instanceof Array))
            this.bucketMap[bucket] = [];
    }

    public getBucketMap(): { [bucket: number]: Inventory.InventoryItem[] } {
        return this.bucketMap;
    }
}

export = BucketGearCollection;