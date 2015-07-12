import Inventory = require('./api-objects/inventory');

class ParserUtils {
    private static itemTierLookupTable: { [name: string]: Inventory.InventoryItemTier } = {
        'Exotic': Inventory.InventoryItemTier.Exotic,
        'Legendary': Inventory.InventoryItemTier.Legendary,
        'Rare': Inventory.InventoryItemTier.Rare,
        'Uncommon': Inventory.InventoryItemTier.Uncommon,
        'Common': Inventory.InventoryItemTier.Common
    };

    private static gearBucketLookupTable: { [bucketId: string]: Inventory.GearBucket } = {
        'BUCKET_BUILD': Inventory.GearBucket.Subclass,
        'BUCKET_PRIMARY_WEAPON': Inventory.GearBucket.PrimaryWeapon,
        'BUCKET_SPECIAL_WEAPON': Inventory.GearBucket.SpecialWeapon,
        'BUCKET_HEAVY_WEAPON': Inventory.GearBucket.HeavyWeapon,
        'BUCKET_HEAD': Inventory.GearBucket.Helmet,
        'BUCKET_ARMS': Inventory.GearBucket.Gauntlets,
        'BUCKET_CHEST': Inventory.GearBucket.ChestArmor,
        'BUCKET_LEGS': Inventory.GearBucket.LegArmor,
        'BUCKET_CLASS_ITEMS': Inventory.GearBucket.ClassItem,
        'BUCKET_GHOST': Inventory.GearBucket.GhostShell,
        'BUCKET_VEHICLE': Inventory.GearBucket.Vehicle,
        'BUCKET_SHIP': Inventory.GearBucket.Ship,
        'BUCKET_SHADER': Inventory.GearBucket.ArmorShader,
        'BUCKET_EMBLEM': Inventory.GearBucket.Emblem
    };

    private static itemTypeLookupTable: { [name: string]: Inventory.InventoryItemType } = {
        'Auto Rifle': Inventory.InventoryItemType.AutoRifle,
        'Pulse Rifle': Inventory.InventoryItemType.PulseRifle,
        'Scout Rifle': Inventory.InventoryItemType.ScoutRifle,
        'Hand Cannon': Inventory.InventoryItemType.HandCannon,
        'Shotgun': Inventory.InventoryItemType.Shotgun,
        'Fusion Rifle': Inventory.InventoryItemType.FusionRifle,
        'Sniper Rifle': Inventory.InventoryItemType.SniperRifle,
        'Machine Gun': Inventory.InventoryItemType.MachineGun,
        'Rocket Launcher': Inventory.InventoryItemType.RocketLauncher,
        'Helmet': Inventory.InventoryItemType.Helmet,
        'Gauntlets': Inventory.InventoryItemType.Gauntlets,
        'Chest Armor': Inventory.InventoryItemType.ChestArmor,
        'Leg Armor': Inventory.InventoryItemType.LegArmor,
        'Warlock Bond': Inventory.InventoryItemType.WarlockBond,
        'Titan Mark': Inventory.InventoryItemType.TitanMark,
        'Hunter Cloak': Inventory.InventoryItemType.HunterCloak,
        'Ghost Shell': Inventory.InventoryItemType.GhostShell,
        'Vehicle': Inventory.InventoryItemType.Vehicle,
        'Ship': Inventory.InventoryItemType.Ship,
        'Armor Shader': Inventory.InventoryItemType.ArmorShader,
        'Emblem': Inventory.InventoryItemType.Emblem,
        'Consumable': Inventory.InventoryItemType.Consumable,
        'Material': Inventory.InventoryItemType.Material,
        'Currency': Inventory.InventoryItemType.Currency
    };

    private static damageTypeLookupTable: { [name: string]: Inventory.DamageType } = {
        'None': Inventory.DamageType.None,
        'Kinetic': Inventory.DamageType.Kinetic,
        'Solar': Inventory.DamageType.Solar,
        'Arc': Inventory.DamageType.Arc,
        'Void': Inventory.DamageType.Void
    };

    public static parseInventoryItemTier(tierString: string): Inventory.InventoryItemTier {
        return this.itemTierLookupTable[tierString];
    }

    public static parseGearBucket(bucketString: string): Inventory.GearBucket {
        return this.gearBucketLookupTable[bucketString];
    }

    public static isWeapon(bucket: Inventory.GearBucket): boolean {
        return bucket == Inventory.GearBucket.PrimaryWeapon
            || bucket == Inventory.GearBucket.SpecialWeapon
            || bucket == Inventory.GearBucket.HeavyWeapon;
    }

    public static parseInventoryItemType(typeString: string): Inventory.InventoryItemType {
        return this.itemTypeLookupTable[typeString];
    }

    public static parseDamageType(typeString: string): Inventory.DamageType {
        return this.damageTypeLookupTable[typeString];
    }


    public static stringifyInventoryItemTier(tier: Inventory.InventoryItemTier): string {
        return this.reverseDictionaryLookup(this.itemTierLookupTable, tier);
    }

    public static stringifyGearBucket(bucket: Inventory.GearBucket): string {
        return this.reverseDictionaryLookup(this.gearBucketLookupTable, bucket);
    }

    public static stringifyInventoryItemType(itemType: Inventory.InventoryItemType): string {
        return this.reverseDictionaryLookup(this.itemTypeLookupTable, itemType);
    }

    public static stringifyDamageType(damageType: Inventory.DamageType): string {
        return this.reverseDictionaryLookup(this.damageTypeLookupTable, damageType);
    }

    private static reverseDictionaryLookup(dict: { [key: string]: any }, lookupValue: any): string {
        for (var originalKey in dict)
            if (dict[originalKey] === lookupValue)
                return originalKey;
    }
}

export = ParserUtils;