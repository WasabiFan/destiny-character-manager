import Inventory = require('./api-objects/inventory');

class ParserUtils {
    private static itemTierLookupTable: { [name: string]: Inventory.InventoryItemTier } = {
        'Exotic': Inventory.InventoryItemTier.Exotic,
        'Legendary': Inventory.InventoryItemTier.Legendary,
        'Rare': Inventory.InventoryItemTier.Rare,
        'Uncommon': Inventory.InventoryItemTier.Uncommon,
        'Common': Inventory.InventoryItemTier.Common
    };

    private static inventoryBucketLookupTable: { [bucketId: string]: Inventory.InventoryBucket } = {
        // Official buckets
        'BUCKET_BUILD': Inventory.InventoryBucket.Subclass,
        'BUCKET_PRIMARY_WEAPON': Inventory.InventoryBucket.PrimaryWeapon,
        'BUCKET_SPECIAL_WEAPON': Inventory.InventoryBucket.SpecialWeapon,
        'BUCKET_HEAVY_WEAPON': Inventory.InventoryBucket.HeavyWeapon,
        'BUCKET_HEAD': Inventory.InventoryBucket.Helmet,
        'BUCKET_ARMS': Inventory.InventoryBucket.Gauntlets,
        'BUCKET_CHEST': Inventory.InventoryBucket.ChestArmor,
        'BUCKET_LEGS': Inventory.InventoryBucket.LegArmor,
        'BUCKET_CLASS_ITEMS': Inventory.InventoryBucket.ClassItem,
        'BUCKET_GHOST': Inventory.InventoryBucket.GhostShell,
        'BUCKET_VEHICLE': Inventory.InventoryBucket.Vehicle,
        'BUCKET_SHIP': Inventory.InventoryBucket.Ship,
        'BUCKET_SHADER': Inventory.InventoryBucket.ArmorShader,
        'BUCKET_EMBLEM': Inventory.InventoryBucket.Emblem,
        'BUCKET_MATERIALS': Inventory.InventoryBucket.Materials,
        'BUCKET_CONSUMABLES': Inventory.InventoryBucket.Consumables,

        // Custom vault buckets
        'BUCKET_VAULT_WEAPON': Inventory.InventoryBucket.VaultWeapon,
        'BUCKET_VAULT_ARMOR': Inventory.InventoryBucket.VaultArmor,
        'BUCKET_VAULT_GENERAL': Inventory.InventoryBucket.VaultGeneral

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

    private static bucketCapacityLookupTable: { [bucketType: string]: number } = {
        // Official buckets
        'BUCKET_BUILD': 2,
        'BUCKET_PRIMARY_WEAPON': 10,
        'BUCKET_SPECIAL_WEAPON': 10,
        'BUCKET_HEAVY_WEAPON': 10,
        'BUCKET_HEAD': 10,
        'BUCKET_ARMS': 10,
        'BUCKET_CHEST': 10,
        'BUCKET_LEGS': 10,
        'BUCKET_CLASS_ITEMS': 10,
        'BUCKET_GHOST': 10,
        'BUCKET_VEHICLE': 10,
        'BUCKET_SHIP': 10,
        'BUCKET_SHADER': 10,
        'BUCKET_EMBLEM': 10,
        'BUCKET_MATERIALS': 15,
        'BUCKET_CONSUMABLES': 15,

        // Custom vault buckets
        'BUCKET_VAULT_WEAPON': 36,
        'BUCKET_VAULT_ARMOR': 24,
        'BUCKET_VAULT_GENERAL': 24
    };

    public static parseInventoryItemTier(tierString: string): Inventory.InventoryItemTier {
        return this.itemTierLookupTable[tierString];
    }

    public static parseInventoryBucket(bucketString: string): Inventory.InventoryBucket {
        return this.inventoryBucketLookupTable[bucketString];
    }

    public static isWeapon(bucket: Inventory.InventoryBucket): boolean {
        return bucket == Inventory.InventoryBucket.PrimaryWeapon
            || bucket == Inventory.InventoryBucket.SpecialWeapon
            || bucket == Inventory.InventoryBucket.HeavyWeapon;
    }

    public static isVault(bucket: Inventory.InventoryBucket): boolean {
        return bucket == Inventory.InventoryBucket.VaultArmor
            || bucket == Inventory.InventoryBucket.VaultGeneral
            || bucket == Inventory.InventoryBucket.VaultWeapon;
    }

    public static getGearBucketForVaultItem(item: Inventory.InventoryItem): Inventory.InventoryBucket {
        // TODO
        return 0;
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

    public static stringifyInventoryBucket(bucket: Inventory.InventoryBucket): string {
        return this.reverseDictionaryLookup(this.inventoryBucketLookupTable, bucket);
    }

    public static stringifyInventoryItemType(itemType: Inventory.InventoryItemType): string {
        return this.reverseDictionaryLookup(this.itemTypeLookupTable, itemType);
    }

    public static stringifyDamageType(damageType: Inventory.DamageType): string {
        return this.reverseDictionaryLookup(this.damageTypeLookupTable, damageType);
    }

    public static findCapacityForBucket(bucket: Inventory.InventoryBucket): number {
        return this.bucketCapacityLookupTable[this.stringifyInventoryBucket(bucket)];
    }

    private static reverseDictionaryLookup(dict: { [key: string]: any }, lookupValue: any): string {
        for (var originalKey in dict)
            if (dict[originalKey] === lookupValue)
                return originalKey;
    }
}

export = ParserUtils;