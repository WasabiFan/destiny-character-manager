import Inventory = require('./api-objects/inventory');
import Character = require('./api-objects/character');
import Membership = require('./api-objects/membership');

class ParserUtils {
    public static exoticBucketGroups: Inventory.InventoryBucket[][] = [
        [
            Inventory.InventoryBucket.PrimaryWeapon,
            Inventory.InventoryBucket.SpecialWeapon,
            Inventory.InventoryBucket.HeavyWeapon
        ], [
            Inventory.InventoryBucket.Helmet,
            Inventory.InventoryBucket.Gauntlets,
            Inventory.InventoryBucket.ChestArmor,
            Inventory.InventoryBucket.LegArmor,
            Inventory.InventoryBucket.ClassItem
        ]
    ];

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
        'Titan Subclass': Inventory.InventoryItemType.TitanSubclass,
        'Hunter Subclass': Inventory.InventoryItemType.HunterSubclass,
        'Warlock Subclass': Inventory.InventoryItemType.WarlockSubclass,
        'Auto Rifle': Inventory.InventoryItemType.AutoRifle,
        'Pulse Rifle': Inventory.InventoryItemType.PulseRifle,
        'Scout Rifle': Inventory.InventoryItemType.ScoutRifle,
        'Hand Cannon': Inventory.InventoryItemType.HandCannon,
        'Shotgun': Inventory.InventoryItemType.Shotgun,
        'Fusion Rifle': Inventory.InventoryItemType.FusionRifle,
        'Sniper Rifle': Inventory.InventoryItemType.SniperRifle,
        'Sidearm': Inventory.InventoryItemType.Sidearm,
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
        'Restore Defaults': Inventory.InventoryItemType.ArmorShader,
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

    public static isWeaponBucket(bucket: Inventory.InventoryBucket): boolean {
        return bucket == Inventory.InventoryBucket.PrimaryWeapon
            || bucket == Inventory.InventoryBucket.SpecialWeapon
            || bucket == Inventory.InventoryBucket.HeavyWeapon;
    }

    public static isVaultBucket(bucket: Inventory.InventoryBucket): boolean {
        return bucket == Inventory.InventoryBucket.VaultArmor
            || bucket == Inventory.InventoryBucket.VaultGeneral
            || bucket == Inventory.InventoryBucket.VaultWeapon;
    }

    public static isArmorBucket(bucket: Inventory.InventoryBucket): boolean {
        return bucket == Inventory.InventoryBucket.VaultArmor
            || bucket == Inventory.InventoryBucket.Helmet
            || bucket == Inventory.InventoryBucket.Gauntlets
            || bucket == Inventory.InventoryBucket.ChestArmor
            || bucket == Inventory.InventoryBucket.LegArmor
            || bucket == Inventory.InventoryBucket.ClassItem;
    }

    public static isInventoryBucket(bucket: Inventory.InventoryBucket): boolean {
        return bucket == Inventory.InventoryBucket.Consumables
            || bucket == Inventory.InventoryBucket.Materials;

    }

    public static isEngram(item: Inventory.InventoryItem) {
        // Should use item hash, but manually finding 40+ item hashes would take a while
        return item.name.indexOf('Engram') >= 0;
    }

    public static isTypeEquippable(item: Inventory.InventoryItem, targetCharacter?: Character.Character) {
        return !this.isEngram(item)
            && ((_.isUndefined(targetCharacter)
                || _.isUndefined((<Inventory.ArmorItem>item).class))
                || targetCharacter.characterClass == (<Inventory.ArmorItem>item).class);
    }

    private static getGearBucketForItemType(type: Inventory.InventoryItemType): Inventory.InventoryBucket {
        switch (type) {
            case Inventory.InventoryItemType.TitanMark:
            case Inventory.InventoryItemType.HunterCloak:
            case Inventory.InventoryItemType.WarlockSubclass:
                return Inventory.InventoryBucket.Subclass;
            case Inventory.InventoryItemType.Consumable:
                return Inventory.InventoryBucket.Consumables;
            case Inventory.InventoryItemType.Material:
            case Inventory.InventoryItemType.Currency:
                return Inventory.InventoryBucket.Materials;
            case Inventory.InventoryItemType.AutoRifle:
            case Inventory.InventoryItemType.ScoutRifle:
            case Inventory.InventoryItemType.HandCannon:
            case Inventory.InventoryItemType.PulseRifle:
                return Inventory.InventoryBucket.PrimaryWeapon;
            case Inventory.InventoryItemType.Shotgun:
            case Inventory.InventoryItemType.FusionRifle:
            case Inventory.InventoryItemType.SniperRifle:
            case Inventory.InventoryItemType.Sidearm:
                return Inventory.InventoryBucket.SpecialWeapon;
            case Inventory.InventoryItemType.MachineGun:
            case Inventory.InventoryItemType.RocketLauncher:
                return Inventory.InventoryBucket.HeavyWeapon;
            case Inventory.InventoryItemType.Helmet:
                return Inventory.InventoryBucket.Helmet;
            case Inventory.InventoryItemType.Gauntlets:
                return Inventory.InventoryBucket.Gauntlets;
            case Inventory.InventoryItemType.ChestArmor:
                return Inventory.InventoryBucket.ChestArmor;
            case Inventory.InventoryItemType.LegArmor:
                return Inventory.InventoryBucket.LegArmor;
            case Inventory.InventoryItemType.WarlockBond:
            case Inventory.InventoryItemType.HunterCloak:
            case Inventory.InventoryItemType.TitanMark:
                return Inventory.InventoryBucket.ClassItem;
            case Inventory.InventoryItemType.GhostShell:
                return Inventory.InventoryBucket.GhostShell;
            case Inventory.InventoryItemType.Vehicle:
                return Inventory.InventoryBucket.Vehicle;
            case Inventory.InventoryItemType.Ship:
                return Inventory.InventoryBucket.Ship;
            case Inventory.InventoryItemType.ArmorShader:
                return Inventory.InventoryBucket.ArmorShader;
            case Inventory.InventoryItemType.Emblem:
                return Inventory.InventoryBucket.Emblem;

            default:
                return Inventory.InventoryBucket.Unknown;
        }
    }

    public static getGearBucketForVaultItem(item: Inventory.InventoryItem): Inventory.InventoryBucket {
        if (!this.isVaultBucket(item.bucket))
            return item.bucket;

        // Non-standard weapons
        switch (String(item.itemHash)) {
            // Universal Remote
            case '1389842217':
            // No Land Beyond
            case '2681212685':
            // Vex Mythoclast
            case '346443849':
                return Inventory.InventoryBucket.PrimaryWeapon;
        }

        return this.getGearBucketForItemType(item.type);
    }

    public static getVaultBucketFromGearBucket(bucket: Inventory.InventoryBucket): Inventory.InventoryBucket {
        switch (Number(bucket)) {
            case Inventory.InventoryBucket.PrimaryWeapon:
            case Inventory.InventoryBucket.SpecialWeapon:
            case Inventory.InventoryBucket.HeavyWeapon:
                return Inventory.InventoryBucket.VaultWeapon;
            case Inventory.InventoryBucket.Helmet:
            case Inventory.InventoryBucket.Gauntlets:
            case Inventory.InventoryBucket.ChestArmor:
            case Inventory.InventoryBucket.LegArmor:
            case Inventory.InventoryBucket.ClassItem:
                return Inventory.InventoryBucket.VaultArmor;
            case Inventory.InventoryBucket.GhostShell:
            case Inventory.InventoryBucket.Vehicle:
            case Inventory.InventoryBucket.Ship:
            case Inventory.InventoryBucket.ArmorShader:
            case Inventory.InventoryBucket.Emblem:
            case Inventory.InventoryBucket.Consumables:
            case Inventory.InventoryBucket.Materials:
                return Inventory.InventoryBucket.VaultGeneral;
            case Inventory.InventoryBucket.VaultArmor:
                return Inventory.InventoryBucket.VaultArmor;
            case Inventory.InventoryBucket.VaultWeapon:
                return Inventory.InventoryBucket.VaultWeapon;
            case Inventory.InventoryBucket.VaultGeneral:
                return Inventory.InventoryBucket.VaultGeneral;
            default:
                return Inventory.InventoryBucket.Unknown;
        }
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

        return undefined;
    }

    public static parseMemberNetworkType(networkStr: string): Membership.MemberNetworkType {
        switch (networkStr.toLowerCase()) {
            case 'xbox':
            case 'xbl':
            case 'live':
                return Membership.MemberNetworkType.XboxLive;
            case 'psn':
            case 'ps':
            case 'playstation':
                return Membership.MemberNetworkType.PlayStationNetwork;
            default:
                return null;
        }
    }
}

export = ParserUtils;