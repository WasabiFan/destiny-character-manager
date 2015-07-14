import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import Inventory = require('./bungie-api/api-objects/inventory');
import Character = require('./bungie-api/api-objects/character');
import Configuration = require('./config-manager');
import Console = require('./command-console');
import ManagementQueue = require('./inventory-management-queue');
import InventoryItemTransferManager = require('./inventory-item-transfer-manager');



export enum FilterQuantifier {
    AndHigher = 1,
    AndLower = -1
}

export class FilterDescriptor {
    public baseTier: Inventory.InventoryItemTier;
    public baseBucket: Inventory.InventoryBucket;
    public quantifier: FilterQuantifier;
    public filterType: FilterType;
}

export class FilterCriteria {
    public tiers: Inventory.InventoryItemTier[] = [];
    public buckets: Inventory.InventoryBucket[] = [];

    public doesMeetCriteria(item: Inventory.InventoryItem): boolean {
        return (this.tiers.length <= 0 || this.tiers.indexOf(item.tier) >= 0)
            && (this.buckets.length <= 0 || this.buckets.indexOf(item.bucket) >= 0);
    }
}

export enum FilterType {
    TierFilter,
    BucketFilter,
    NameFilter,
    Invalid = -1
}

export enum FilterMode {
    Add,
    Remove
}