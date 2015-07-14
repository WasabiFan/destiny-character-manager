import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import Inventory = require('./bungie-api/api-objects/inventory');
import Character = require('./bungie-api/api-objects/character');
import Configuration = require('./config-manager');
import Console = require('./command-console');
import InventoryManager = require('./inventory-manager');
import InventoryItemTransferManager = require('./inventory-item-transfer-manager');

export class FilterUtils {
    public static customIndexOf<T>(collection: T[], selector: (item: T) => boolean): number {
        var targetIndex: number = -1;
        for (var i in collection)
            if (selector(collection[i]))
                targetIndex = i;

        return targetIndex;
    }

    public static getTiersForQuantifier(baseTier: Inventory.InventoryItemTier, quantifier: FilterQuantifier): Inventory.InventoryItemTier[] {
        if (quantifier == undefined)
            return [baseTier];

        var result: Inventory.InventoryItemTier[] = [];
        for (var tier: number = baseTier; tier >= 0 && Inventory.InventoryItemTier[tier] != undefined; tier += quantifier)
            result.push(tier);

        return result;
    }
}

export enum FilterQuantifier {
    AndHigher = 1,
    AndLower = -1
}

export class FilterData {
    public static bucketFilterStrs = {
        'primary': Inventory.InventoryBucket.PrimaryWeapon,
        'pri': Inventory.InventoryBucket.PrimaryWeapon,
        'p': Inventory.InventoryBucket.PrimaryWeapon,
        'special': Inventory.InventoryBucket.SpecialWeapon,
        'spec': Inventory.InventoryBucket.SpecialWeapon,
        's': Inventory.InventoryBucket.SpecialWeapon,
        'secondary': Inventory.InventoryBucket.SpecialWeapon,
        'heavy': Inventory.InventoryBucket.HeavyWeapon,
        'h': Inventory.InventoryBucket.HeavyWeapon,
    };

    public static tierFilterStrs = {
        'common': Inventory.InventoryItemTier.Common,
        'c': Inventory.InventoryItemTier.Common,
        'uncommon': Inventory.InventoryItemTier.Uncommon,
        'unc': Inventory.InventoryItemTier.Uncommon,
        'u': Inventory.InventoryItemTier.Uncommon,
        'rare': Inventory.InventoryItemTier.Rare,
        'r': Inventory.InventoryItemTier.Rare,
        'legendary': Inventory.InventoryItemTier.Legendary,
        'l': Inventory.InventoryItemTier.Legendary,
        'exotic': Inventory.InventoryItemTier.Exotic,
        'ex': Inventory.InventoryItemTier.Exotic,
        'e': Inventory.InventoryItemTier.Exotic,
    };

    public static quantifierFilterStrs = {
        '+': FilterQuantifier.AndHigher,
        '-': FilterQuantifier.AndLower
    }

}

export class FilterPart {
    public baseTier: Inventory.InventoryItemTier;
    public baseBucket: Inventory.InventoryBucket;
    public quantifier: FilterQuantifier;
    public filterType: FilterType;

    constructor(filterPart: string) {
        if (filterPart.indexOf('~') === 0) {
            this.filterType = FilterType.NameFilter;
            // TODO: parse name part
            return;
        }

        var wordPartMatches = filterPart.match(/^\w+/);

        if (wordPartMatches == undefined) {
            this.filterType = FilterType.Invalid;
            return;
        }

        var wordPart = wordPartMatches[0];

        var tierFilter = FilterData.tierFilterStrs[wordPart];
        var bucketFilter = FilterData.bucketFilterStrs[wordPart];
        var quantifierAddition = FilterData.quantifierFilterStrs[filterPart.substring(wordPart.length)];

        if (tierFilter != undefined) {
            this.filterType = FilterType.TierFilter;
            this.baseTier = tierFilter;
            this.quantifier = quantifierAddition;
        }
        else if (bucketFilter != undefined) {
            this.filterType = FilterType.BucketFilter;
            this.baseBucket = bucketFilter;
        }
        else {
            this.filterType = FilterType.Invalid;
        }
    }

}

// TODO: rename to Filter
export class InventoryFilter {
    public tiers: Inventory.InventoryItemTier[] = [];
    public buckets: Inventory.InventoryBucket[] = [];

    constructor(filterStr: string) {
        if (filterStr == undefined || filterStr.length <= 0)
            return;
        
        // TODO: support quantifiers for bucket?
        var filterParts = filterStr.split(';');
        for (var i in filterParts) {
            var filterDesc = new FilterPart(filterParts[i]);

            switch (filterDesc.filterType) {
                case FilterType.Invalid:
                    console.error('Invalid filter: ' + filterParts[i]);
                    break;
                case FilterType.NameFilter:
                    // TODO
                    break;
                case FilterType.BucketFilter:
                    this.buckets.push(filterDesc.baseBucket);
                    break;
                case FilterType.TierFilter:
                    var newTiers = FilterUtils.getTiersForQuantifier(filterDesc.baseTier, filterDesc.quantifier);
                    this.tiers.push.apply(this.tiers, newTiers);
                    break;
            }
        }
    }

    public doesMeetCriteria(item: Inventory.InventoryItem): boolean {
        return (this.tiers.length <= 0 || this.tiers.indexOf(item.tier) >= 0)
            && (this.buckets.length <= 0 || this.buckets.indexOf(item.bucket) >= 0);
    }

    public findMatchesInCollection(itemCollection: Inventory.InventoryItem[]): Inventory.InventoryItem[] {
        var result: Inventory.InventoryItem[] = [];
        for (var i in itemCollection) {
            if (this.doesMeetCriteria(itemCollection[i]))
                result.push(itemCollection[i]);
        }

        return result;
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