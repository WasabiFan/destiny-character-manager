// Bungie API
import Inventory = require('../bungie-api/api-objects/inventory');
import ParserUtils = require('../bungie-api/parser-utils');

export class FilterUtils {
    public static customIndexOf<T>(collection: T[], selector: (item: T) => boolean): number {
        for (var i in collection)
            if (selector(collection[i]))
                return i;

        return -1;
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
        // Weapons
        'primary': Inventory.InventoryBucket.PrimaryWeapon,
        'pri': Inventory.InventoryBucket.PrimaryWeapon,
        'p': Inventory.InventoryBucket.PrimaryWeapon,
        'special': Inventory.InventoryBucket.SpecialWeapon,
        'spec': Inventory.InventoryBucket.SpecialWeapon,
        's': Inventory.InventoryBucket.SpecialWeapon,
        'secondary': Inventory.InventoryBucket.SpecialWeapon,
        'heavy': Inventory.InventoryBucket.HeavyWeapon,
        'h': Inventory.InventoryBucket.HeavyWeapon,

        // Armor
        'helmet': Inventory.InventoryBucket.Helmet,
        'helm': Inventory.InventoryBucket.Helmet,
        'gauntlet': Inventory.InventoryBucket.Gauntlets,
        'gauntlets': Inventory.InventoryBucket.Gauntlets,
        'gaunt': Inventory.InventoryBucket.Gauntlets,
        'chest': Inventory.InventoryBucket.ChestArmor,
        'legs': Inventory.InventoryBucket.LegArmor,
        'leg': Inventory.InventoryBucket.LegArmor,
        'class': Inventory.InventoryBucket.ClassItem,

        // Extras
        'vehicle': Inventory.InventoryBucket.Vehicle,
        'v': Inventory.InventoryBucket.Vehicle,
        'material': Inventory.InventoryBucket.Materials,
        'materials': Inventory.InventoryBucket.Materials,
        'mat': Inventory.InventoryBucket.Materials,
        'consumable': Inventory.InventoryBucket.Consumables,
        'consumables': Inventory.InventoryBucket.Consumables,
        'con': Inventory.InventoryBucket.Consumables,
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
    public baseKeyword: string;
    public quantifier: FilterQuantifier;
    public filterType: FilterType;

    constructor(filterPart: string) {
        if (filterPart.indexOf('~') === 0) {
            this.filterType = FilterType.NameFilter;
            this.baseKeyword = filterPart.substring(1);
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
    public keywords: string[] = [];

    constructor(filterStr: string) {
        if (filterStr == undefined || filterStr.length <= 0)
            return;
        
        var filterParts = filterStr.split(';');
        for (var i in filterParts) {
            var filterPart = new FilterPart(filterParts[i]);

            switch (filterPart.filterType) {
                case FilterType.Invalid:
                    console.error('Invalid filter: ' + filterParts[i]);
                    break;
                case FilterType.NameFilter:
                    this.keywords.push(filterPart.baseKeyword.toLowerCase());
                    break;
                case FilterType.BucketFilter:
                    this.buckets.push(filterPart.baseBucket);
                    break;
                case FilterType.TierFilter:
                    var newTiers = FilterUtils.getTiersForQuantifier(filterPart.baseTier, filterPart.quantifier);
                    this.tiers.push.apply(this.tiers, newTiers);
                    break;
            }
        }
    }

    public doesMeetCriteria(item: Inventory.InventoryItem): boolean {
        // TODO: add a filter property to enable or disable this normalization
        var itemBucketInGear = ParserUtils.getGearBucketForVaultItem(item);

        return (this.tiers.length <= 0 || this.tiers.indexOf(item.tier) >= 0)
            && (this.buckets.length <= 0 || this.buckets.indexOf(itemBucketInGear) >= 0)
            && (this.keywords.length <= 0 || FilterUtils.customIndexOf(item.name.toLowerCase().split(/[\s-]+/g), item => this.keywords.indexOf(item) >= 0) >= 0);
    }

    public findMatchesInCollection(itemCollection: Inventory.InventoryItem[]): Inventory.InventoryItem[] {
        var result: Inventory.InventoryItem[] = [];
        for (var i of itemCollection) {
            if (this.doesMeetCriteria(i))
                result.push(i);
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