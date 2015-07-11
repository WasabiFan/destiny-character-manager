import Inventory = require('./inventory-item');

class ParserUtils {
    public static parseInventoryItemTier(tierString: string): Inventory.InventoryItemTier {
        // TODO: Implement
        return Inventory.InventoryItemTier.Exotic;
    }

    public static parseGearBucket(bucketString: string): Inventory.GearBucket {
        // TODO: Implement
        return Inventory.GearBucket.ArmorShader;
    }

    public static parseInventoryItemType(typeString: string): Inventory.InventoryItemType {
        // TODO: Implement
        return Inventory.InventoryItemType.Currency;
    }

    public static parseDamageType(typeString: string): Inventory.DamageType {
        // TODO: Implement
        return Inventory.DamageType.Kinetic;
    }


    public static stringifyInventoryItemTier(tier: Inventory.InventoryItemTier): string {
        // TODO: Implement
        return "";
    }

    public static stringifyGearBucket(bucket: Inventory.GearBucket): string {
        // TODO: Implement
        return "";
    }

    public static stringifyInventoryItemType(type: Inventory.InventoryItemType): string {
        // TODO: Implement
        return "";
    }

    public static stringifyDamageType(type: Inventory.DamageType): string {
        // TODO: Implement
        return "";
    }
}

export = ParserUtils;