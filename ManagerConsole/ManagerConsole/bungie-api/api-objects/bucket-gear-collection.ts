import Inventory = require('./inventory');
import Character = require('./character');
import ParserUtils = require('../parser-utils');
import _ = require('underscore');

export class BucketGearCollection {
    private bucketMap: { [bucket: number]: InventoryBucketState } = {};
    private parentCharacter: Character.Character;

    constructor(items?: Inventory.InventoryItem[], parentCharacter?: Character.Character) {
        if (_.isUndefined(parentCharacter) && !_.isUndefined(items))
            parentCharacter = <any>items;

        if (_.isArray(items)) {
            for (var item of items)
                this.addItem(item);
        }

        if (!_.isUndefined(parentCharacter))
            this.parentCharacter = parentCharacter;
    }

    public hasBucket(bucket: Inventory.InventoryBucket): boolean {
        return !_.isUndefined(this.bucketMap[bucket]);
    }

    public addItem(item: Inventory.InventoryItem) {
        this.createBucket(item.bucket);
        this.bucketMap[item.bucket].contents.push(item);
    }

    public getItems(bucket: Inventory.InventoryBucket): Inventory.InventoryItem[]{
        var bucketState = this.bucketMap[bucket];

        if (_.isUndefined(bucketState))
            return [];

        return bucketState.contents;
    }

    public getEquippedItem(bucket: Inventory.InventoryBucket): Inventory.InventoryItem {
        for (var item of this.bucketMap[bucket].contents)
            if (item instanceof Inventory.GearItem && (<Inventory.GearItem>item).isEquipped)
                return item;

        return null;
    }

    public getAllItems(): Inventory.InventoryItem[]{
        var result: Inventory.InventoryItem[] = [];
        for (var bucket in this.bucketMap) {
            result = result.concat(this.bucketMap[bucket].contents);
        }

        return result;
    }

    public createBucket(bucket: Inventory.InventoryBucket) {
        if (_.isUndefined(this.bucketMap[bucket]))
            this.bucketMap[bucket] = new InventoryBucketState(bucket);
    }

    public getBucketMap(): { [bucket: number]: InventoryBucketState } {
        return this.bucketMap;
    }
}



export class InventoryBucketState {
    private _capacity: number;
    public get capacity(): number {
        return this._capacity;
    }

    public contents: Inventory.InventoryItem[] = [];
    public bucketType: Inventory.InventoryBucket;

    public parentCharacter: Character.Character;

    public constructor(bucketType: Inventory.InventoryBucket) {
        this.bucketType = bucketType;
        this._capacity = ParserUtils.findCapacityForBucket(this.bucketType);
    }
}