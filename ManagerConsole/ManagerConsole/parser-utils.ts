import Inventory = require('./inventory-item');

class ParserUtils {
    private static itemTierLookupTable = {
        'Exotic': Inventory.InventoryItemTier.Exotic,
        'Legendary': Inventory.InventoryItemTier.Legendary,
        'Rare': Inventory.InventoryItemTier.Rare,
        'Uncommon': Inventory.InventoryItemTier.Uncommon,
        'Common': Inventory.InventoryItemTier.Common
    };

    private static gearBucketLookupTable = {
        'BUCKET_BUILD': Inventory.GearBucket.Subclass,
        'BUCKET_PRIMARY_WEAPON': Inventory.GearBucket.PrimaryWeapon,
        'BUCLET_SPECIAL_WEAPON': Inventory.GearBucket.SpecialWeapon,
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

    private static itemTypeLookupTable = {
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

    private static damageTypeLookupTable = {
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
        if (bucket == Inventory.GearBucket.PrimaryWeapon || bucket == Inventory.GearBucket.SpecialWeapon || Inventory.GearBucket.HeavyWeapon) {
            return true;
        }
        else
            return false;
    }

    public static parseInventoryItemType(typeString: string): Inventory.InventoryItemType {
        return this.itemTypeLookupTable[typeString];
    }

    public static parseDamageType(typeString: string): Inventory.DamageType {
        return this.damageTypeLookupTable[typeString];
    }


    public static stringifyInventoryItemTier(tier: Inventory.InventoryItemTier): string {
        var arr = Object.keys(this.itemTierLookupTable);
        for (var i = 0; i < arr.length; i++)
            if (tier == this.itemTierLookupTable[arr[i]])
                return arr[i];
    }

    public static stringifyGearBucket(bucket: Inventory.GearBucket): string {
        var arr = Object.keys(this.gearBucketLookupTable);
        for (var i = 0; i < arr.length; i++)
            if (bucket == this.gearBucketLookupTable[arr[i]])
                return arr[i];
    }

    public static stringifyInventoryItemType(itemType: Inventory.InventoryItemType): string {
        var arr = Object.keys(this.itemTypeLookupTable);
        for (var i = 0; i < arr.length; i++)
            if (itemType == this.itemTierLookupTable[arr[i]])
                return arr[i];
    }

    public static stringifyDamageType(damageType: Inventory.DamageType): string {
        var arr = Object.keys(this.damageTypeLookupTable);
        for (var i = 0; i < arr.length; i++)
            if (damageType == this.damageTypeLookupTable[arr[i]])
                return arr[i];
    }
}

export = ParserUtils;