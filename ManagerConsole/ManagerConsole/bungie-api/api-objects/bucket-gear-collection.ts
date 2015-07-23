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
            for (var i in items)
                this.addItem(items[i]);
        }

        if (!_.isUndefined(parentCharacter))
            this.parentCharacter = parentCharacter;
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
        for (var i in this.bucketMap[bucket])
            if (this.bucketMap[bucket][i] instanceof Inventory.GearItem && (<Inventory.GearItem>this.bucketMap[bucket][i]).isEquipped)
                return this.bucketMap[bucket][i];

        return null;
    }

    public getAllItems(): Inventory.InventoryItem[]{
        var result: Inventory.InventoryItem[] = [];
        for (var bucket in this.bucketMap) {
            result = result.concat(this.bucketMap[bucket].contents);
        }

        return result;
    }

    private createBucket(bucket: Inventory.InventoryBucket) {
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
        this._capacity = ParserUtils.findCapacityForBucket(this.bucketType);
        this.bucketType = bucketType;
    }
}