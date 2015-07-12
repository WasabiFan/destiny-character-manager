export class InventoryItem {
    public name: string;
    public tier: InventoryItemTier;
    public type: InventoryItemType;
    public instanceId: string;
    public itemHash: string;

    public static loadFromPlain(plainObj: any): InventoryItem {
        var newItem = new InventoryItem();
        newItem.name = plainObj.name;
        newItem.tier = plainObj.tier;
        newItem.type = plainObj.type;
        newItem.instanceId = plainObj.instanceId;
        newItem.itemHash = plainObj.itemHash;

        return newItem;
    }

    public getIsEquipped(): boolean {
        // TODO
        return false;
    }
}

export class StackableItem extends InventoryItem {
    public stackSize: number;
}

export class GearItem extends InventoryItem {
    public isEquipped: boolean;
    public bucket: GearBucket;
}

export class WeaponItem extends GearItem {
    public damageType: DamageType;
}

export enum InventoryItemTier {
    Common,
    Uncommon,
    Rare,
    Legendary,
    Exotic,
    Unknown = -1
}

export enum GearBucket {
    // Subclass
    Subclass,

    // Weapons
    PrimaryWeapon,
    SpecialWeapon,
    HeavyWeapon,

    // Armor
    Helmet,
    Gauntlets,
    ChestArmor,
    LegArmor,
    ClassItem,

    // Equipment
    GhostShell,
    Vehicle,
    Ship,
    ArmorShader,
    Emblem,

    // Unknown
    Unknown = -1
}

export enum InventoryItemType {
    // Subclasses
    TitanSubclass,
    HunterSubclass,
    WarlockSubclass,

    // Generic inventory
    Consumable,
    Material,
    Currency,

    // Weapons
    AutoRifle,
    ScoutRifle,
    HandCannon,
    PulseRifle,
    Shotgun,
    FusionRifle,
    SniperRifle,
    MachineGun,
    RocketLauncher,

    // Armor
    Helmet,
    Gauntlets,
    ChestArmor,
    LegArmor,

    //Class Items
    WarlockBond,
    HunterCloak,
    TitanMark,

    // Equipment
    GhostShell,
    Vehicle,
    Ship,
    ArmorShader,
    Emblem
}

export enum DamageType {
    // Murmur is a weapon, yet reports 'None' due to its
    // variable damage type
    None,
    Kinetic,
    Solar,
    Arc,
    Void
}