export class InventoryItem {
    public name: string;
    public tier: InventoryItemTier;
    public type: InventoryItemType;
    public itemId: string;
    public itemHash: string;
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
    Exotic
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
    Emblem
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