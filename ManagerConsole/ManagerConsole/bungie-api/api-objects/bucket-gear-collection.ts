import Inventory = require('./inventory');

class BucketGearCollection {

    private bucketMap: { [bucket: number]: Inventory.GearItem[] } = {};

    public addItem(item: Inventory.GearItem) {
        this.createBucket(item.bucket);
        this.bucketMap[item.bucket].push(item);
    }

    public getItems(bucket: Inventory.GearBucket): Inventory.GearItem[]{
        return this.bucketMap[bucket];
    }

    public getEquippedItem(bucket: Inventory.GearBucket): Inventory.GearItem {
        for (var i in this.bucketMap[bucket])
            if (this.bucketMap[bucket][i].isEquipped)
                return this.bucketMap[bucket][i];

        return null;
    }

    public getAllItems(): Inventory.GearItem[]{
        var result: Inventory.GearItem[] = [];
        for (var bucket in this.bucketMap) {
            result = result.concat(this.bucketMap[bucket]);
        }

        return result;
    }

    private createBucket(bucket: Inventory.GearBucket) {
        if (!(this.bucketMap[bucket] instanceof Array))
            this.bucketMap[bucket] = [];
    }
}

export = BucketGearCollection;