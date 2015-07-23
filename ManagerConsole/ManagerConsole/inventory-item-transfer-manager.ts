import Inventory = require('./bungie-api/api-objects/inventory');
import AppConfiguration = require('./config-manager');
import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import BucketGearCollection = require('./bungie-api/api-objects/bucket-gear-collection');
import Character = require('./bungie-api/api-objects/character');
import Membership = require('./bungie-api/api-objects/membership');
import ApiCore = require('./bungie-api/api-core');
import InventoryManager = require('./inventory-manager');
import ParserUtils = require('./bungie-api/parser-utils');
import Errors = require('./errors');
var destiny = require('destiny-client')();

class InventoryItemTransferManager {
    private inventoryMan: InventoryManager.InventoryManager;

    constructor(inventoryMan: InventoryManager.InventoryManager) {
        this.inventoryMan = inventoryMan;
    }

    private intersectArraysOfObjects(uniqueIdentifierAttributeName: string, ...arrays: any[][]) {
        var arr, i, id, j, len, len1, name, obj, objectsById, ref;
        objectsById = {};
        for (i = 0, len = arrays.length; i < len; i++) {
            arr = arrays[i];
            for (j = 0, len1 = arr.length; j < len1; j++) {
                obj = arr[j];
                (objectsById[name = obj[uniqueIdentifierAttributeName]] || (objectsById[name] = [])).push(obj);
            }
        }
        return (ref = []).concat.apply(ref,(function () {
            var results;
            results = [];
            for (id in objectsById) {
                arr = objectsById[id];
                if (arr.length === arrays.length) {
                    results.push(arr[0]);
                }
            }
            return results;
        })());
    }

    private diffArraysOfObjects(uniqueIdentifierAttributeName: string, ...arrays: any[][]) {
        var arr, i, id, j, len, len1, name, obj, objectsById, ref;
        objectsById = {};
        for (i = 0, len = arrays.length; i < len; i++) {
            arr = arrays[i];
            for (j = 0, len1 = arr.length; j < len1; j++) {
                obj = arr[j];
                (objectsById[name = obj[uniqueIdentifierAttributeName]] || (objectsById[name] = [])).push(obj);
            }
        }
        return (ref = []).concat.apply(ref,(function () {
            var results;
            results = [];
            for (id in objectsById) {
                arr = objectsById[id];
                if (arr.length === 1) {
                    results.push(arr[0]);
                }
            }
            return results;
        })());
    }

    private findTempItems(lookupBucketContents: Inventory.InventoryItem[], designatedItems: Inventory.InventoryItem[]) {
        // TODO: Remove all this duplicate code
        // It looks like we can always use both attribs
        var checkAttributeNames = ['instanceId'];
        if (lookupBucketContents.length > 0 && ParserUtils.getVaultBucketFromGearBucket(lookupBucketContents[0].bucket) == Inventory.InventoryBucket.VaultGeneral)
            checkAttributeNames.push('itemHash');
        var arr, i, id, j, len, len1, name, obj, objectsById, ref;
        var arrays = [];
        arrays.push(lookupBucketContents, designatedItems);
        objectsById = {};
        for (i = 0, len = arrays.length; i < len; i++) {
            arr = arrays[i];
            for (j = 0, len1 = arr.length; j < len1; j++) {
                obj = arr[j];
                var matches = true;
                if ((objectsById[obj[checkAttributeNames.join('')]] && i > 0) || i < 1 && !objectsById[obj[checkAttributeNames.join('')]])
                    (objectsById[name = obj[checkAttributeNames.join('')]] || (objectsById[name] = [])).push(obj);
            }
        }
        return (ref = []).concat.apply(ref,(function () {
            var results;
            results = [];
            for (id in objectsById) {
                arr = objectsById[id];
                if (arr.length === 1) {
                    results.push(arr[0]);
                }
            }
            return results;
        })());
    }

    private getCharactersFullInfo(state: InventoryManager.InventoryState, currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, target: Character.Character) {
        var characters = AppConfiguration.currentConfig.characters;

        var targetCharacterIndex;
        var nonTargets: Character.Character[] = [];
        for (var i = 0; i < characters.length; i++) {
            if (characters[i].id != target.id)
                nonTargets.push(characters[i]);
            else
                targetCharacterIndex = i;
        }
        var areCharactersFull = true;
        var charsFull: { [charId: string]: boolean } = {};
        for (var charId in state.characters) {
            if (state.characters[charId].buckets[currentBucket].capacity != state.characters[charId].buckets[currentBucket].contents.length) {
                areCharactersFull = false;
                charsFull[charId] = false;
            }
            else
                charsFull[charId] = true;
        }
        var vaultFull = state.vault.buckets[currentVaultBucket].capacity == state.vault.buckets[currentVaultBucket].contents.length;
        var vaultEmpty = state.vault.buckets[currentVaultBucket].contents.length == 0;
        var nonTargetsFull = true;
        var nonFullNonTargetIndex: number;
        for (var j = 0; j < nonTargets.length; j++)
            if (!charsFull[nonTargets[j].id]) {
                nonTargetsFull = false;
                nonFullNonTargetIndex = j;
            }
        return { charactersFull: areCharactersFull, charsFull: charsFull, targetFull: charsFull[characters[targetCharacterIndex].id], vaultFull: vaultFull, vaultEmpty: vaultEmpty, nonTargetsFull: nonTargetsFull, nonFullNonTargetIndex: nonFullNonTargetIndex };
    }

    private moveAnyItemFromVault(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[], exclude: string[]) {
        var state = this.inventoryMan.currentState;
        var characters = AppConfiguration.currentConfig.characters;

        var fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfObjects('instanceId', state.vault.buckets[currentVaultBucket].contents, AppConfiguration.currentConfig.designatedItems);
        var diff: Inventory.InventoryItem[] = this.findTempItems(state.vault.buckets[currentVaultBucket].contents, AppConfiguration.currentConfig.designatedItems);
        // TODO: When inventory works on characters, we can do this
        for (var i = 0; i < diff.length; i++) {
            if (diff[i].bucket == Inventory.InventoryBucket.Consumables ||
                diff[i].bucket == Inventory.InventoryBucket.Materials)
                diff.splice(i, 1);
        }
        for (var i = 0; i < intersection.length; i++) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(intersection[i])
            if (gearBucket != currentBucket && state.characters[targetCharacter.id].buckets[gearBucket].capacity != state.characters[targetCharacter.id].buckets[gearBucket].contents.length && exclude.indexOf(intersection[i].instanceId) == -1) {
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, intersection[i]);
                return;
            }
        }
        for (var i = 0; i < diff.length; i++) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(diff[i]);
            for (var j = 0; j < characters.length; j++) {
                if (characters[j].id == targetCharacter.id)
                    continue;
                if (state.characters[characters[j].id].buckets[gearBucket].contents.length < state.characters[characters[j].id].buckets[gearBucket].capacity && exclude.indexOf(intersection[i].instanceId) == -1) {
                    this.inventoryMan.enqueueMoveOperation(state.characters[j], false, diff[i]);
                    return;
                }
            }
            if (gearBucket != currentBucket && state.characters[targetCharacter.id].buckets[gearBucket].capacity > state.characters[targetCharacter.id].buckets[gearBucket].contents.length && exclude.indexOf(diff[i].instanceId) == -1) {
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, diff[i]);
                return;
            }
        }
        for (var i = 0; i < intersection.length; i++) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(intersection[i]);
            for (var j = 0; j < characters.length; j++) {
                if (characters[j].id == targetCharacter.id)
                    continue;
                if (gearBucket != currentBucket && state.characters[j].buckets[gearBucket].capacity > state.characters[j].buckets[gearBucket].contents.length && exclude.indexOf(intersection[i].instanceId) == -1) {
                    this.inventoryMan.enqueueMoveOperation(state.characters[j], false, intersection[i]);
                    return;
                }
            }
        }
        for (var i = 0; i < diff.length; i++) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(diff[i]);
            if (state.characters[targetCharacter.id].buckets[gearBucket].contents.length < state.characters[targetCharacter.id].buckets[gearBucket].capacity && exclude.indexOf(diff[i].instanceId) == -1) {
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, diff[i]);
                return;
            }
        }
        for (var i = 0; i < intersection.length; i++) {
            if (ParserUtils.getGearBucketForVaultItem(diff[i]) == currentBucket && state.characters[targetCharacter.id].buckets[currentBucket].contents.length < state.characters[targetCharacter.id].buckets[currentBucket].capacity && exclude.indexOf(intersection[i].instanceId) == -1) {
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, intersection[i]);
                return;
            }
        }
        return -1;
    }

    private prepForTransfer(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = this.inventoryMan.currentState;

        var fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
        if (fullInfo.vaultFull) {
            if (this.moveAnyItemFromVault(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems, []) == -1) {
                console.error('No space is availible in inventory or vault to effect transfer');
                return;
            }
        }

        fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
        var targetBucket = state.characters[targetCharacter.id].buckets[currentBucket];
        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfObjects('instanceId', targetBucket.contents, AppConfiguration.currentConfig.designatedItems);
        for (var i = 0; i < intersection.length; i++) {
            if (intersection[i].getIsEquipped() == false) {
                this.inventoryMan.enqueueEquipOperation(state.characters[targetCharacter.id], intersection[i]);
                break;
            }
        }
    }

    private moveUnequippedItems(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = this.inventoryMan.currentState;
        var characters = AppConfiguration.currentConfig.characters;

        var fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
        var items: { item: Inventory.GearItem; char: string }[] = [];
        for (var i = 0; i < characters.length; i++) {
            if (characters[i].id == targetCharacter.id)
                continue;
            var intersection: Inventory.GearItem[] = this.intersectArraysOfObjects('instanceId', state.characters[characters[i].id].buckets[currentBucket].contents, AppConfiguration.currentConfig.designatedItems);
            for (var j = 0; j < intersection.length; j++)
                if (!intersection[j].isEquipped)
                    items.push({ item: intersection[j], char: characters[i].id });
        }
        var vaultIntersection: Inventory.GearItem[] = this.intersectArraysOfObjects('instanceId', state.vault.buckets[currentVaultBucket].contents, bucketDesignatedItems);
        for (var i = 0; i < vaultIntersection.length; i++)
            items.push({ item: vaultIntersection[j], char: "-1" });
        for (var i = 0; i < items.length; i++) {
            var targetIntersection: Inventory.GearItem[] = this.intersectArraysOfObjects('instanceId', state.characters[targetCharacter.id].buckets[currentBucket].contents, AppConfiguration.currentConfig.designatedItems);
            if (targetIntersection.length > 8)
                this.equipDesignatedItem(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems);
            var isInVault = items[i].char == "-1";

            fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
            if (fullInfo.targetFull) {
                if (!isInVault)
                    this.inventoryMan.enqueueMoveOperation(state.characters[items[i].char], true, items[i].item);
                this.moveAnyItemFromVault(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems, [items[i].item.instanceId]);
                var temps: Inventory.InventoryItem[] = this.findTempItems(state.characters[targetCharacter.id].buckets[currentBucket].contents, AppConfiguration.currentConfig.designatedItems);
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], true, temps[0]);
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, items[i].item);
            }
            else {
                if (!isInVault)
                    this.inventoryMan.enqueueMoveOperation(state.characters[items[i].char], true, items[i].item);
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, items[i].item);
            }
        }
    }

    private equipDesignatedItem(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = this.inventoryMan.currentState;
        var characters = AppConfiguration.currentConfig.characters;

        var bucket = state.characters[targetCharacter.id].buckets[currentBucket];
        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfObjects('instanceId', bucket.contents, AppConfiguration.currentConfig.designatedItems);
        for (var i = 0; i < intersection.length; i++) {
            if (intersection[i].getIsEquipped() == true)
                return;
            else if (intersection[i].getIsEquipped() == false) {
                this.inventoryMan.enqueueEquipOperation(state.characters[targetCharacter.id], intersection[i]);
                return;
            }
        }
    }

    private moveEquippedItems(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = this.inventoryMan.currentState;
        var characters = AppConfiguration.currentConfig.characters;

        var items: { item: Inventory.GearItem; char: string }[] = [];
        for (var i = 0; i < characters.length; i++) {
            if (characters[i].id == targetCharacter.id)
                continue;
            var inventoriedItems: Inventory.GearItem[] = this.intersectArraysOfObjects('instanceId', state.characters[characters[i].id].buckets[currentBucket].contents, AppConfiguration.currentConfig.designatedItems);
            for (var j = 0; j < inventoriedItems.length; j++) {
                if (inventoriedItems[j].getIsEquipped() == true) {
                    items.push({ item: inventoriedItems[j], char: characters[i].id });
                }
            }
        }

        for (var i = 0; i < items.length; i++) {
            var toEquip: Inventory.InventoryItem;
            if (state.characters[items[i].char].buckets[currentBucket].contents.length == 1) {
                var vaultTemps: Inventory.InventoryItem[] = this.findTempItems(state.vault.buckets[currentVaultBucket].contents, bucketDesignatedItems);
                var vaultTemp;
                if (vaultTemps.length > 0) {
                    vaultTemp = vaultTemps[0];
                }
                else {
                    for (var j = 0; j < characters.length; j++) {
                        var temps: Inventory.InventoryItem[] = this.findTempItems(state.characters[j].buckets[currentBucket].contents, AppConfiguration.currentConfig.designatedItems);
                        if (temps.length > 0) {
                            this.inventoryMan.enqueueMoveOperation(state.characters[j], true, temps[0]);
                            vaultTemp = temps[0]
                        }
                    }
                }
                this.inventoryMan.enqueueMoveOperation(state.characters[items[i].char], false, vaultTemp);
                toEquip = vaultTemp;
            }
            if (!toEquip) {
                var sourceBucket = state.characters[items[i].char].buckets[currentBucket];
                for (var j = 0; j < sourceBucket.contents.length; j++) {
                    if (sourceBucket.contents[j].getIsEquipped() == false)
                        toEquip = sourceBucket.contents[j];
                }
            }
            this.inventoryMan.enqueueEquipOperation(state.characters[items[i].char], toEquip);
        }

        this.moveUnequippedItems(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems);
    }

    private moveTargetTemps(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = this.inventoryMan.currentState;
        var targetBucket = state.characters[targetCharacter.id].buckets[currentBucket];
        var temps: Inventory.InventoryItem[] = this.findTempItems(targetBucket.contents, AppConfiguration.currentConfig.designatedItems);

        for (var i = 0; i < temps.length; i++) {
            if (temps[i].getIsEquipped() == true)
                continue;

            var fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);

            if (fullInfo.vaultFull && !fullInfo.nonTargetsFull) {
                if (this.moveAnyItemFromVault(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems, []) == -1)
                    continue;
            }
            else if (fullInfo.vaultFull && fullInfo.nonTargetsFull)
                break;

            this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], true, temps[i]);
        }
    }

    public transferDesignatedItems(target: Character.Character) {
        if (!this.inventoryMan.isLoaded)
            // TODO: Return error instead
            throw new Errors.Exception('The inventory must be loaded before transferring items.');

        var state = this.inventoryMan.currentState;
        var characters = AppConfiguration.currentConfig.characters;

        // Find all designated items
        var designatedItems = AppConfiguration.currentConfig.designatedItems;
        var designatedBuckets: Inventory.InventoryBucket[] = [];
        for (var i = 0; i < designatedItems.length; i++) {
            if (designatedBuckets.indexOf(designatedItems[i].bucket) == -1)
                designatedBuckets.push(designatedItems[i].bucket);
        }
        // Loop through buckets
        for (var i = 0; i < designatedBuckets.length; i++) {
            var currentBucket = designatedBuckets[i];
            if (currentBucket == Inventory.InventoryBucket.GhostShell || currentBucket == Inventory.InventoryBucket.Subclass)
                continue;
            var bucketDesignatedItems: Inventory.InventoryItem[] = [];
            for (var j = 0; j < designatedItems.length; j++)
                if (designatedItems[j].bucket == currentBucket)
                    bucketDesignatedItems.push(designatedItems[j]);

            var currentVaultBucket = ParserUtils.getVaultBucketFromGearBucket(currentBucket);
            this.prepForTransfer(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
            this.moveUnequippedItems(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
            this.equipDesignatedItem(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
            this.moveEquippedItems(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
            this.moveTargetTemps(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
        }
    }
}

export = InventoryItemTransferManager;