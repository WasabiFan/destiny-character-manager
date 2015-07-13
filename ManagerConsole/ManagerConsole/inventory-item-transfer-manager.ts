import Inventory = require('./bungie-api/api-objects/inventory');
import AppConfiguration = require('./config-manager');
import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import BucketGearCollection = require('./bungie-api/api-objects/bucket-gear-collection');
import Character = require('./bungie-api/api-objects/character');
import Membership = require('./bungie-api/api-objects/membership');
import ApiCore = require('./bungie-api/api-core');
import Queue = require('./inventory-management-queue');
import ParserUtils = require('./bungie-api/parser-utils');
var destiny = require('destiny-client')();

class InventoryItemTransferManager {
    private static intersectArraysOfObjects(uniqueIdentifierAttributeName: string, ...arrays: any[][]) {
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

    private static diffArraysOfObjects(uniqueIdentifierAttributeName: string, ...arrays: any[][]) {
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

    private static findTempItems(lookupBucketContents: Inventory.InventoryItem[], designatedItems: Inventory.InventoryItem[]) {
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

    private static getCharactersFullInfo(state: Queue.InventoryState, bucketIndex: number, vaultBucketIndex: number, characters: Character.Character[], target: Character.Character) {
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
            if (state.characters[charId].buckets[bucketIndex].capacity != state.characters[charId].buckets[bucketIndex].contents.length) {
                areCharactersFull = false;
                charsFull[charId] = false;
            }
            else
                charsFull[charId] = true;
        }
        var vaultFull = state.vault.buckets[vaultBucketIndex].capacity == state.vault.buckets[vaultBucketIndex].contents.length;
        var vaultEmpty = state.vault.buckets[vaultBucketIndex].contents.length == 0;
        var nonTargetsFull = true;
        var nonFullNonTargetIndex: number;
        for (var j = 0; j < nonTargets.length; j++)
            if (!charsFull[nonTargets[j].id]) {
                nonTargetsFull = false;
                nonFullNonTargetIndex = j;
            }
        return { charactersFull: areCharactersFull, charsFull: charsFull, targetFull: charsFull[characters[targetCharacterIndex].id], vaultFull: vaultFull, vaultEmpty: vaultEmpty, nonTargetsFull: nonTargetsFull, nonFullNonTargetIndex: nonFullNonTargetIndex };
    }

    private static moveAnyItemFromVault(queue: Queue.InventoryManagementQueue, characters: Character.Character[], bucketIndex: number, vaultBucketIndex: number, target: Character.Character, targetIndex: string, designatedItems: Inventory.InventoryItem[], bucketDesignatedItems: Inventory.InventoryItem[], exclude: string[]) {
        var state = queue.getCurrentState();
        var fullInfo = this.getCharactersFullInfo(state, bucketIndex, vaultBucketIndex, characters, target);
        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfObjects('instanceId', state.vault.buckets[vaultBucketIndex].contents, designatedItems);
        var diff: Inventory.InventoryItem[] = this.findTempItems(state.vault.buckets[vaultBucketIndex].contents, designatedItems);
        // TODO: When inventory works on characters, we can do this
        for (var i = 0; i < diff.length; i++) {
            if (diff[i].bucket == Inventory.InventoryBucket.Consumables ||
                diff[i].bucket == Inventory.InventoryBucket.Materials)
                diff.splice(i, 1);
        }
        for (var i = 0; i < intersection.length; i++) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(intersection[i])
            if (gearBucket != bucketIndex && state.characters[targetIndex].buckets[gearBucket].capacity != state.characters[targetIndex].buckets[gearBucket].contents.length && exclude.indexOf(intersection[i].instanceId) == -1) {
                queue.enqueueMoveOperation(state.characters[targetIndex], false, intersection[i]);
                return;
            }
        }
        for (var i = 0; i < diff.length; i++) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(diff[i]);
            for (var j = 0; j < characters.length; j++) {
                if (characters[j].id == target.id)
                    continue;
                if (state.characters[characters[j].id].buckets[gearBucket].contents.length < state.characters[characters[j].id].buckets[gearBucket].capacity && exclude.indexOf(intersection[i].instanceId) == -1) {
                    queue.enqueueMoveOperation(state.characters[j], false, diff[i]);
                    return;
                }
            }
            if (gearBucket != bucketIndex && state.characters[targetIndex].buckets[gearBucket].capacity > state.characters[targetIndex].buckets[gearBucket].contents.length && exclude.indexOf(diff[i].instanceId) == -1) {
                queue.enqueueMoveOperation(state.characters[targetIndex], false, diff[i]);
                return;
            }
        }
        for (var i = 0; i < intersection.length; i++) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(intersection[i]);
            for (var j = 0; j < characters.length; j++) {
                if (characters[j].id == target.id)
                    continue;
                if (gearBucket != bucketIndex && state.characters[j].buckets[gearBucket].capacity > state.characters[j].buckets[gearBucket].contents.length && exclude.indexOf(intersection[i].instanceId) == -1) {
                    queue.enqueueMoveOperation(state.characters[j], false, intersection[i]);
                    return;
                }
            }
        }
        for (var i = 0; i < diff.length; i++) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(diff[i]);
            if (state.characters[targetIndex].buckets[gearBucket].contents.length < state.characters[targetIndex].buckets[gearBucket].capacity && exclude.indexOf(diff[i].instanceId) == -1) {
                queue.enqueueMoveOperation(state.characters[targetIndex], false, diff[i]);
                return;
            }
        }
        for (var i = 0; i < intersection.length; i++) {
            if (ParserUtils.getGearBucketForVaultItem(diff[i]) == bucketIndex && state.characters[targetIndex].buckets[bucketIndex].contents.length < state.characters[targetIndex].buckets[bucketIndex].capacity && exclude.indexOf(intersection[i].instanceId) == -1) {
                queue.enqueueMoveOperation(state.characters[targetIndex], false, intersection[i]);
                return;
            }
        }
        return -1;
    }

    private static prepForTransfer(queue: Queue.InventoryManagementQueue, characters: Character.Character[], bucketIndex: number, vaultBucketIndex: number, target: Character.Character, targetIndex: string, designatedItems: Inventory.InventoryItem[], bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = queue.getCurrentState();
        var fullInfo = this.getCharactersFullInfo(state, bucketIndex, vaultBucketIndex, characters, target);
        if (fullInfo.vaultFull) {
            if (this.moveAnyItemFromVault(queue, characters, bucketIndex, vaultBucketIndex, target, targetIndex, designatedItems, bucketDesignatedItems, []) == -1) {
                console.error('No space is availible in inventory or vault to effect transfer');
                return;
            }
        }
        state = queue.getCurrentState();
        fullInfo = this.getCharactersFullInfo(state, bucketIndex, vaultBucketIndex, characters, target);
        var targetBucket = state.characters[targetIndex].buckets[bucketIndex];
        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfObjects('instanceId', targetBucket.contents, designatedItems);
        for (var i = 0; i < intersection.length; i++) {
            if (intersection[i].getIsEquipped() == false) {
                queue.enqueueEquipOperation(state.characters[targetIndex], intersection[i]);
                break;
            }
        }
    }

    private static moveUnequippedItems(queue: Queue.InventoryManagementQueue, characters: Character.Character[], bucketIndex: number, vaultBucketIndex: number, target: Character.Character, targetIndex: string, designatedItems: Inventory.InventoryItem[], bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = queue.getCurrentState();
        var fullInfo = this.getCharactersFullInfo(state, bucketIndex, vaultBucketIndex, characters, target);
        var items: { item: Inventory.GearItem; char: number }[] = [];
        for (var i = 0; i < characters.length; i++) {
            if (characters[i].id == target.id)
                continue;
            var intersection: Inventory.GearItem[] = this.intersectArraysOfObjects('instanceId', state.characters[characters[i].id].buckets[bucketIndex].contents, designatedItems);
            for (var j = 0; j < intersection.length; j++)
                if (!intersection[j].isEquipped)
                    items.push({ item: intersection[j], char: i });
        }
        var vaultIntersection: Inventory.GearItem[] = this.intersectArraysOfObjects('instanceId', state.vault.buckets[vaultBucketIndex].contents, bucketDesignatedItems);
        for (var i = 0; i < vaultIntersection.length; i++)
            if (!vaultIntersection[i].isEquipped)
                items.push({ item: vaultIntersection[j], char: -1 });
        for (var i = 0; i < items.length; i++) {
            var targetIntersection: Inventory.GearItem[] = this.intersectArraysOfObjects('instanceId', state.characters[targetIndex].buckets[bucketIndex].contents, designatedItems);
            if (targetIntersection.length > 8)
                this.equipDesignatedItem(queue, characters, bucketIndex, vaultBucketIndex, target, targetIndex, designatedItems, bucketDesignatedItems);
            var isInVault = items[i].char == -1;
            state = queue.getCurrentState();
            fullInfo = this.getCharactersFullInfo(state, bucketIndex, vaultBucketIndex, characters, target);
            if (fullInfo.targetFull) {
                if (!isInVault)
                    queue.enqueueMoveOperation(state.characters[items[i].char], true, items[i].item);
                this.moveAnyItemFromVault(queue, characters, bucketIndex, vaultBucketIndex, target, targetIndex, designatedItems, bucketDesignatedItems, [items[i].item.instanceId]);
                var temps: Inventory.InventoryItem[] = this.findTempItems(state.characters[targetIndex].buckets[bucketIndex].contents, designatedItems);
                queue.enqueueMoveOperation(state.characters[targetIndex], true, temps[0]);
                queue.enqueueMoveOperation(state.characters[targetIndex], false, items[i].item);
            }
            else {
                if (!isInVault)
                    queue.enqueueMoveOperation(state.characters[items[i].char], true, items[i].item);
                queue.enqueueMoveOperation(state.characters[targetIndex], false, items[i].item);
            }
        }
    }

    private static equipDesignatedItem(queue: Queue.InventoryManagementQueue, characters: Character.Character[], bucketIndex: number, vaultBucketIndex: number, target: Character.Character, targetIndex: string, designatedItems: Inventory.InventoryItem[], bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = queue.getCurrentState();
        var bucket = state.characters[targetIndex].buckets[bucketIndex];
        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfObjects('instanceId', bucket.contents, designatedItems);
        for (var i = 0; i < intersection.length; i++) {
            if (intersection[i].getIsEquipped() == true)
                return;
            else if (intersection[i].getIsEquipped() == false) {
                queue.enqueueEquipOperation(state.characters[targetIndex], intersection[i]);
                return;
            }
        }
    }

    private static moveEquippedItems(queue: Queue.InventoryManagementQueue, characters: Character.Character[], bucketIndex: number, vaultBucketIndex: number, target: Character.Character, targetIndex: string, designatedItems: Inventory.InventoryItem[], bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = queue.getCurrentState();
        var items: { item: Inventory.GearItem; char: string }[] = [];
        for (var i = 0; i < characters.length; i++) {
            if (characters[i].id == target.id)
                continue;
            var inventoriedItems: Inventory.GearItem[] = this.intersectArraysOfObjects('instanceId', state.characters[characters[i].id].buckets[bucketIndex].contents, designatedItems);
            for (var j = 0; j < inventoriedItems.length; j++) {
                if (inventoriedItems[j].getIsEquipped() == true) {
                    items.push({ item: inventoriedItems[j], char: characters[i].id });
                }
            }
        }
        for (var i = 0; i < items.length; i++) {
            state = queue.getCurrentState();
            var toEquip: Inventory.InventoryItem;
            if (state.characters[items[i].char].buckets[bucketIndex].contents.length == 1) {
                var vaultTemps: Inventory.InventoryItem[] = this.findTempItems(state.vault.buckets[vaultBucketIndex].contents, bucketDesignatedItems);
                var vaultTemp;
                if (vaultTemps.length > 0) {
                    vaultTemp = vaultTemps[0];
                }
                else {
                    for (var j = 0; j < characters.length; j++) {
                        var temps: Inventory.InventoryItem[] = this.findTempItems(state.characters[j].buckets[bucketIndex].contents, designatedItems);
                        if (temps.length > 0) {
                            queue.enqueueMoveOperation(state.characters[j], true, temps[0]);
                            vaultTemp = temps[0]
                        }
                    }
                }
                queue.enqueueMoveOperation(state.characters[items[i].char], false, vaultTemp);
                toEquip = vaultTemp;
            }
            if (!toEquip) {
                var sourceBucket = state.characters[items[i].char].buckets[bucketIndex];
                for (var j = 0; j < sourceBucket.contents.length; j++) {
                    if (sourceBucket.contents[j].getIsEquipped() == false)
                        toEquip = sourceBucket.contents[j];
                }
            }
            queue.enqueueEquipOperation(state.characters[items[i].char], toEquip);
        }
        this.moveUnequippedItems(queue, characters, bucketIndex, vaultBucketIndex, target, targetIndex, designatedItems, bucketDesignatedItems);
    }

    private static moveTargetTemps(queue: Queue.InventoryManagementQueue, characters: Character.Character[], bucketIndex: number, vaultBucketIndex: number, target: Character.Character, targetIndex: string, designatedItems: Inventory.InventoryItem[], bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = queue.getCurrentState();
        var targetBucket = state.characters[targetIndex].buckets[bucketIndex];
        var temps: Inventory.InventoryItem[] = this.findTempItems(targetBucket.contents, designatedItems);
        for (var i = 0; i < temps.length; i++) {
            state = queue.getCurrentState();
            if (temps[i].getIsEquipped() == true)
                continue;
            var fullInfo = this.getCharactersFullInfo(state, bucketIndex, vaultBucketIndex, characters, target);
            if (fullInfo.vaultFull && !fullInfo.nonTargetsFull) {
                if (this.moveAnyItemFromVault(queue, characters, bucketIndex, vaultBucketIndex, target, targetIndex, designatedItems, bucketDesignatedItems, []) == -1)
                    continue;
            }
            else if (fullInfo.vaultFull && fullInfo.nonTargetsFull)
                break;
            queue.enqueueMoveOperation(state.characters[targetIndex], true, temps[i]);
        }
    }

    public static transferDesignatedItems(target: Character.Character) {
        var queue = new Queue.InventoryManagementQueue();
        queue.loadState().then(() => {
            var state = queue.getCurrentState();
            var characters = AppConfiguration.currentConfig.characters;
            var targetIndex: string = target.id;
            // Find all designated items
            var designatedItems = AppConfiguration.currentConfig.designatedItems;
            // Loop through buckets
            for (var bucketIndex in state.characters[targetIndex].buckets) {
                if (bucketIndex == Inventory.InventoryBucket.GhostShell || bucketIndex == Inventory.InventoryBucket.Subclass)
                    continue;
                var bucketDesignatedItems: Inventory.InventoryItem[] = [];
                for (var j = 0; j < designatedItems.length; j++)
                    if (designatedItems[j].bucket == bucketIndex)
                        bucketDesignatedItems.push(designatedItems[j]);
                var vaultBucketIndex = ParserUtils.getVaultBucketFromGearBucket(bucketIndex);
                this.prepForTransfer(queue, characters, bucketIndex, vaultBucketIndex, target, targetIndex, designatedItems, bucketDesignatedItems);
                this.moveUnequippedItems(queue, characters, bucketIndex, vaultBucketIndex, target, targetIndex, designatedItems, bucketDesignatedItems);
                this.equipDesignatedItem(queue, characters, bucketIndex, vaultBucketIndex, target, targetIndex, designatedItems, bucketDesignatedItems);
                this.moveEquippedItems(queue, characters, bucketIndex, vaultBucketIndex, target, targetIndex, designatedItems, bucketDesignatedItems);
                this.moveTargetTemps(queue, characters, bucketIndex, vaultBucketIndex, target, targetIndex, designatedItems, bucketDesignatedItems);
            }
        }).catch((err) => {
            console.error(err);
        });
    }
};

export = InventoryItemTransferManager;