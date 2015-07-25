import _ = require('underscore');
var destiny = require('destiny-client')();

// Bungie API
import Inventory = require('../bungie-api/api-objects/inventory');
import Character = require('../bungie-api/api-objects/character');
import ParserUtils = require('../bungie-api/parser-utils');

// Utils
import DataStores = require('../utils/data-stores');
import Errors = require('../utils/errors');

// API helpers
import InventoryManager = require('./inventory-manager');

class InventoryTransferManager {
    private inventoryMan: InventoryManager.InventoryManager;
    private promiseParams;

    constructor(inventoryMan: InventoryManager.InventoryManager) {
        this.inventoryMan = inventoryMan;
    }

    private intersectArraysOfObjects(uniqueIdentifierAttributeNames: string[], ...arrays: any[][]) {
        var arr, i, id, j, len, len1, name, obj, objectsById, ref;
        objectsById = {};
        for (i = 0, len = arrays.length; i < len; i++) {
            arr = arrays[i];
            for (j = 0, len1 = arr.length; j < len1; j++) {
                obj = arr[j];
                var str = '';
                for (var nameIndex = 0; nameIndex < uniqueIdentifierAttributeNames.length; nameIndex++)
                    str += obj[uniqueIdentifierAttributeNames[nameIndex]] + ',';
                if (str.length > 1)
                    str = str.substring(0, str.length - 2);
                (objectsById[str] || (objectsById[str] = [])).push(obj);
            }
        }
        return (ref = []).concat.apply(ref, (function () {
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

    private intersectArraysOfInventoryItems(...items: Inventory.InventoryItem[][]): Inventory.InventoryItem[] {
        return this.intersectArraysOfObjects.apply(this, (<any[]>[['itemHash', 'instanceId']]).concat(items));
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
        return (ref = []).concat.apply(ref, (function () {
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

    private findTempItems(lookupBucketContents: Inventory.InventoryItem[], designatedItems: Inventory.InventoryItem[], bucket?: Inventory.InventoryBucket) {
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
                var str = '';
                for (var nameIndex = 0; nameIndex < checkAttributeNames.length; nameIndex++) {
                    str += (obj[checkAttributeNames[nameIndex]] + ',') || '';
                }
                if (str.length > 1)
                    str = str.substring(0, str.length - 2)
                if ((objectsById[str] != undefined && i > 0) || i < 1 && objectsById[str] == undefined)
                    (objectsById[str] || (objectsById[str] = [])).push(obj);
            }
        }
        return (ref = []).concat.apply(ref, (function () {
            var results;
            results = [];
            for (id in objectsById) {
                arr = objectsById[id];
                if (arr.length === 1 && ParserUtils.getGearBucketForVaultItem(arr[0])) {
                    results.push(arr[0]);
                }
            }
            return results;
        })());
    }

    private getCharactersFullInfo(state: InventoryManager.InventoryState, currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, target: Character.Character) {
        var characters = DataStores.DataStores.appConfig.currentData.characters;

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
            if (state.characters[charId].bucketCollection.hasBucket(currentBucket) && ParserUtils.findCapacityForBucket(currentBucket) != state.characters[charId].bucketCollection.getItems(currentBucket).length) {
                areCharactersFull = false;
                charsFull[charId] = false;
            }
            else if (state.characters[charId].bucketCollection.hasBucket(currentBucket))
                charsFull[charId] = true;
            else
                charsFull[charId] = false;
        }
        var vaultFull = ParserUtils.findCapacityForBucket(currentVaultBucket) == state.vault.bucketCollection.getItems(currentVaultBucket).length;
        var vaultEmpty = state.vault.bucketCollection.getItems(currentVaultBucket).length == 0;
        var nonTargetsFull = true;
        var nonFullNonTargetIndex: number;
        for (var j = 0; j < nonTargets.length; j++)
            if (!charsFull[nonTargets[j].id]) {
                nonTargetsFull = false;
                nonFullNonTargetIndex = j;
            }
        return { charactersFull: areCharactersFull, charsFull: charsFull, targetFull: charsFull[characters[targetCharacterIndex].id], vaultFull: vaultFull, vaultEmpty: vaultEmpty, nonTargetsFull: nonTargetsFull, nonFullNonTargetIndex: nonFullNonTargetIndex };
    }

    private moveAnyItemFromVault(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[], exclude: Inventory.InventoryItem[]) {
        var excludeStrings = [];
        for (var i = 0; i < exclude.length; i++)
            excludeStrings.push(exclude[i].instanceId + ',' + exclude[i].itemHash);

        var state = this.inventoryMan.currentState;
        var characters = DataStores.DataStores.appConfig.currentData.characters;

        var fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(state.vault.bucketCollection.getItems(currentVaultBucket), DataStores.DataStores.appConfig.currentData.designatedItems);
        var diff: Inventory.InventoryItem[] = this.findTempItems(state.vault.bucketCollection.getItems(currentVaultBucket), DataStores.DataStores.appConfig.currentData.designatedItems);
        // TODO: When inventory works on characters, we can do this
        for (var i = 0; i < diff.length; i++) {
            if (diff[i].bucket == Inventory.InventoryBucket.Consumables ||
                diff[i].bucket == Inventory.InventoryBucket.Materials)
                diff.splice(i, 1);
        }
        for (var i = 0; i < intersection.length; i++) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(intersection[i])
            if (gearBucket != currentBucket && ParserUtils.findCapacityForBucket(gearBucket) != state.characters[targetCharacter.id].bucketCollection.getItems(gearBucket).length && excludeStrings.indexOf(intersection[i].instanceId + ',' + intersection[i].itemHash) == -1) {
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, intersection[i]);
                return;
            }
        }
        for (var i = 0; i < diff.length; i++) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(diff[i]);
            for (var j = 0; j < characters.length; j++) {
                if (characters[j].id == targetCharacter.id)
                    continue;
                if (state.characters[characters[j].id].bucketCollection.getItems(gearBucket).length < ParserUtils.findCapacityForBucket(gearBucket) && excludeStrings.indexOf(diff[i].instanceId + ',' + diff[i].itemHash) == -1) {
                    this.inventoryMan.enqueueMoveOperation(state.characters[characters[j].id], false, diff[i]);
                    return;
                }
            }
            if (gearBucket != currentBucket && ParserUtils.findCapacityForBucket(gearBucket) > state.characters[targetCharacter.id].bucketCollection.getItems(gearBucket).length && excludeStrings.indexOf(diff[i].instanceId + ',' + diff[i].itemHash) == -1) {
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, diff[i]);
                return;
            }
        }
        for (var i = 0; i < intersection.length; i++) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(intersection[i]);
            for (var j = 0; j < characters.length; j++) {
                if (characters[j].id == targetCharacter.id)
                    continue;
                if (gearBucket != currentBucket && ParserUtils.findCapacityForBucket(gearBucket) > state.characters[characters[j].id].bucketCollection.getItems(gearBucket).length && excludeStrings.indexOf(intersection[i].instanceId + ',' + intersection[i].itemHash) == -1) {
                    this.inventoryMan.enqueueMoveOperation(state.characters[characters[j].id], false, intersection[i]);
                    return;
                }
            }
        }
        for (var i = 0; i < diff.length; i++) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(diff[i]);
            if (state.characters[targetCharacter.id].bucketCollection.getItems(gearBucket).length < ParserUtils.findCapacityForBucket(gearBucket) && excludeStrings.indexOf(diff[i].instanceId + ',' + diff[i].itemHash) == -1) {
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, diff[i]);
                return;
            }
        }
        for (var i = 0; i < intersection.length; i++) {
            if (ParserUtils.getGearBucketForVaultItem(diff[i]) == currentBucket && state.characters[targetCharacter.id].bucketCollection.getItems(currentBucket).length < ParserUtils.findCapacityForBucket(currentBucket) && excludeStrings.indexOf(intersection[i].instanceId + ',' + intersection[i].itemHash) == -1) {
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, intersection[i]);
                return;
            }
        }
        return -1;
    }

    private prepForTransfer(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[], reject): Promise<any> {
        var state = this.inventoryMan.currentState;

        var fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
        if (fullInfo.vaultFull) {
            if (this.moveAnyItemFromVault(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems, []) == -1) {
                this.promiseParams.reject(new Error('No space is availible in inventory or vault to effect transfer'));
                return;
            }
        }

        fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(state.characters[targetCharacter.id].bucketCollection.getItems(currentBucket), DataStores.DataStores.appConfig.currentData.designatedItems);
        var exoticEquipped;
        if (intersection.length > 0)
            exoticEquipped = this.getExoticEquipped(state, currentBucket, targetCharacter).exoticEquipped;
        for (var i = 0; i < intersection.length; i++) {
            if (intersection[i].getIsEquipped() == true)
                break;
            if (intersection[i].getIsEquipped() == false && !(intersection[i].tier == Inventory.InventoryItemTier.Exotic && exoticEquipped == true)) {
                this.inventoryMan.enqueueEquipOperation(state.characters[targetCharacter.id], intersection[i]);
                break;
            }
        }
    }

    private moveUnequippedItems(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = this.inventoryMan.currentState;
        var characters = DataStores.DataStores.appConfig.currentData.characters;

        var fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
        var items: { item: Inventory.InventoryItem; char: string }[] = [];
        for (var i = 0; i < characters.length; i++) {
            if (characters[i].id == targetCharacter.id)
                continue;
            var intersection: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(state.characters[characters[i].id].bucketCollection.getItems(currentBucket), DataStores.DataStores.appConfig.currentData.designatedItems);
            for (var j = 0; j < intersection.length; j++)
                if (!intersection[j].getIsEquipped() == true)
                    items.push({ item: intersection[j], char: characters[i].id });
        }
        var vaultIntersection: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(state.vault.bucketCollection.getItems(currentVaultBucket), bucketDesignatedItems);
        for (var i = 0; i < vaultIntersection.length; i++)
            items.push({ item: vaultIntersection[i], char: "-1" });
        for (var i = 0; i < items.length; i++) {
            var targetIntersection: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(state.characters[targetCharacter.id].bucketCollection.getItems(currentBucket), DataStores.DataStores.appConfig.currentData.designatedItems);
            if (targetIntersection.length > 8)
                this.equipDesignatedItem(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems);
            var isInVault = items[i].char == "-1";

            fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
            if (fullInfo.targetFull) {
                if (!isInVault)
                    this.inventoryMan.enqueueMoveOperation(state.characters[items[i].char], true, items[i].item);
                this.moveAnyItemFromVault(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems, [items[i].item]);
                var temps: Inventory.InventoryItem[] = this.findTempItems(state.characters[targetCharacter.id].bucketCollection.getItems(currentBucket), DataStores.DataStores.appConfig.currentData.designatedItems);
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
        var characters = DataStores.DataStores.appConfig.currentData.characters;

        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(state.characters[targetCharacter.id].bucketCollection.getItems(currentBucket), DataStores.DataStores.appConfig.currentData.designatedItems);
        for (var i = 0; i < intersection.length; i++) {
            if (intersection[i].getIsEquipped() == true)
                return;
            if (intersection[i].tier == Inventory.InventoryItemTier.Exotic)
                continue;
            if (intersection[i].getIsEquipped() == false) {
                this.inventoryMan.enqueueEquipOperation(state.characters[targetCharacter.id], intersection[i]);
                return;
            }
        }
        var exoticEquipped = this.getExoticEquipped(state, currentBucket, targetCharacter);
        if (!exoticEquipped) {
            for (var i = 0; i < intersection.length; i++) {
                if (intersection[i].getIsEquipped() == true)
                    return;
                else if (intersection[i].getIsEquipped() == false) {
                    this.inventoryMan.enqueueEquipOperation(state.characters[targetCharacter.id], intersection[i]);
                    return;
                }
            }
        }
        else {
            // TODO: Add system to remove equipped exotic if possible
        }
    }

    private getExoticEquipped(state: InventoryManager.InventoryState, bucket: Inventory.InventoryBucket, target: Character.Character) {
        for (var exoticBucketIndex = 0; exoticBucketIndex < ParserUtils.exoticBucketGroups.length; exoticBucketIndex++) {
            if (ParserUtils.exoticBucketGroups[exoticBucketIndex].indexOf(bucket) == -1)
                continue;
            for (var bucketIndex = 0; bucketIndex < ParserUtils.exoticBucketGroups[exoticBucketIndex].length; bucketIndex++) {
                for (var itemIndex = 0; itemIndex < state.characters[target.id].bucketCollection.getItems(ParserUtils.exoticBucketGroups[exoticBucketIndex][bucketIndex]).length; itemIndex++) {
                    var item = state.characters[target.id].bucketCollection.getItems(ParserUtils.exoticBucketGroups[exoticBucketIndex][bucketIndex])[itemIndex];
                    if (item.getIsEquipped() == true && item.tier == Inventory.InventoryItemTier.Exotic) {
                        return {
                            'exoticEquipped': true, 'bucketIndex': ParserUtils.exoticBucketGroups[exoticBucketIndex][bucketIndex]
                        };
                    }
                }
            }
        }
        return {
            'exoticEquipped': false
        };
    }

    private moveEquippedItems(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = this.inventoryMan.currentState;
        var characters = DataStores.DataStores.appConfig.currentData.characters;

        var items: { item: Inventory.InventoryItem; char: string }[] = [];
        for (var i = 0; i < characters.length; i++) {
            if (characters[i].id == targetCharacter.id)
                continue;
            var inventoriedItems: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(state.characters[characters[i].id].bucketCollection.getItems(currentBucket), DataStores.DataStores.appConfig.currentData.designatedItems);
            for (var j = 0; j < inventoriedItems.length; j++) {
                if (inventoriedItems[j].getIsEquipped() == true) {
                    items.push({ item: inventoriedItems[j], char: characters[i].id });
                }
            }
        }

        for (var i = 0; i < items.length; i++) {
            var toEquip: Inventory.InventoryItem;
            if (state.characters[items[i].char].bucketCollection.getItems(currentBucket).length == 1) {
                var vaultTemps: Inventory.InventoryItem[] = this.findTempItems(state.vault.bucketCollection.getItems(currentVaultBucket), bucketDesignatedItems);
                var vaultTemp;
                if (vaultTemps.length > 0) {
                    for (var j = 0; j < vaultTemps.length; j++) {
                        if (ParserUtils.getGearBucketForVaultItem(vaultTemps[j]) != currentBucket) {
                            vaultTemps.splice(j, 1);
                            //j = Math.max(0, j);
                            continue;
                        }
                        if (vaultTemps[j].tier != Inventory.InventoryItemTier.Exotic) {
                            vaultTemp = vaultTemps[j];
                            break;
                        }
                    }
                    if (vaultTemp == undefined)
                        for (var j = 0; j < vaultTemps.length; j++) {
                            vaultTemp = vaultTemps[j];
                            break;
                        }
                }
                else {
                    for (var j = 0; j < characters.length; j++) {
                        var temps: Inventory.InventoryItem[] = this.findTempItems(state.characters[characters[j].id].bucketCollection.getItems(currentBucket), DataStores.DataStores.appConfig.currentData.designatedItems);
                        if (temps.length > 0) {
                            this.inventoryMan.enqueueMoveOperation(state.characters[characters[j].id], true, temps[0]);
                            vaultTemp = temps[0]
                        }
                    }
                }
                this.inventoryMan.enqueueMoveOperation(state.characters[items[i].char], false, vaultTemp);
                toEquip = vaultTemp;
            }
            if (!toEquip) {
                var sourceBucket = state.characters[items[i].char].bucketCollection.getItems(currentBucket);
                for (var j = 0; j < sourceBucket.length; j++) {
                    if (sourceBucket[j].getIsEquipped() == false)
                        toEquip = sourceBucket[j];
                }
            }
            this.inventoryMan.enqueueEquipOperation(state.characters[items[i].char], toEquip);
        }

        this.moveUnequippedItems(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems);
    }

    private moveTargetTemps(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = this.inventoryMan.currentState;
        var temps: Inventory.InventoryItem[] = this.findTempItems(state.characters[targetCharacter.id].bucketCollection.getItems(currentBucket), DataStores.DataStores.appConfig.currentData.designatedItems);

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

    private checkTransferNeeded(state: InventoryManager.InventoryState, target: Character.Character, bucketIndex: Inventory.InventoryBucket, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var intersection = this.intersectArraysOfInventoryItems(state.characters[target.id].bucketCollection.getItems(bucketIndex), bucketDesignatedItems);
        if (intersection.length == bucketDesignatedItems.length)
            return false;
        return true;
    }

    public transferDesignatedItems(target: Character.Character) {
        return new Promise((resolve, reject) => {
            this.promiseParams = { 'resolve': resolve, 'reject': reject };
            if (!this.inventoryMan.isLoaded)
                reject(new Errors.Exception('The inventory must be loaded before transferring items.'));

            var state = this.inventoryMan.currentState;
            var characters = DataStores.DataStores.appConfig.currentData.characters;

            // Find all designated items
            var designatedItems = DataStores.DataStores.appConfig.currentData.designatedItems;
            var designatedBuckets: Inventory.InventoryBucket[] = [];
            var designatedBucketItems: Inventory.InventoryItem[][] = [];
            for (var i = 0; i < designatedItems.length; i++) {
                var bucket = ParserUtils.getGearBucketForVaultItem(designatedItems[i]);
                if (designatedBuckets.indexOf(bucket) == -1)
                    designatedBuckets.push(bucket);
                if (!(designatedBucketItems[bucket]))
                    designatedBucketItems[bucket] = [];
                designatedBucketItems[bucket].push(designatedItems[i]);
            }
            ParserUtils.exoticBucketGroups.forEach((bucketGroup, index) => {
                var onlyExotics = _.select(bucketGroup, bucket => {
                    var items = designatedBucketItems[bucket] || [];
                    return items.length > 0 && _.every(items, item => item.tier === Inventory.InventoryItemTier.Exotic);
                });
                if (onlyExotics.length > 1)
                    reject(new Error('There must be at least three armor buckets and two weapon buckets with non- exotic items in them'));
            });
            // Loop through buckets
            for (var i = 0; i < designatedBuckets.length; i++) {
                var currentBucket = designatedBuckets[i];
                if (currentBucket == Inventory.InventoryBucket.GhostShell || currentBucket == Inventory.InventoryBucket.Subclass)
                    continue;
                var bucketDesignatedItems: Inventory.InventoryItem[] = designatedBucketItems[currentBucket];
                var transferNeeded = this.checkTransferNeeded(state, target, currentBucket, bucketDesignatedItems);
                if (transferNeeded == false)
                    continue;
                var isInventory = currentBucket == Inventory.InventoryBucket.Materials || currentBucket == Inventory.InventoryBucket.Consumables;

                var currentVaultBucket = ParserUtils.getVaultBucketFromGearBucket(currentBucket);
                this.prepForTransfer(currentBucket, currentVaultBucket, target, bucketDesignatedItems, reject);
                this.moveUnequippedItems(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
                this.equipDesignatedItem(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
                if (!isInventory)
                    this.moveEquippedItems(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
                this.moveTargetTemps(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
            }

            this.inventoryMan.getCurrentQueueTerminationPromise().then(() => {
                resolve();
            }).catch(reject);
        });
    }
}

export = InventoryTransferManager;