﻿import _ = require('underscore');
var destiny = require('destiny-client')();

// Bungie API
import Inventory = require('../bungie-api/api-objects/inventory');
import Character = require('../bungie-api/api-objects/character');
import ParserUtils = require('../bungie-api/parser-utils');

// Utils
import AppConfiguration = require('../utils/config-manager');
import Errors = require('../utils/errors');

// API helpers
import InventoryManager = require('./inventory-manager');

class InventoryTransferManager {
    private inventoryMan: InventoryManager.InventoryManager;
    private promiseParams;

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
                if ((objectsById[obj[checkAttributeNames.join('')]] && i > 0) || i < 1 && !objectsById[obj[checkAttributeNames.join('')]])
                    (objectsById[name = obj[checkAttributeNames.join('')]] || (objectsById[name] = [])).push(obj);
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
        var targetBucket = state.characters[targetCharacter.id].buckets[currentBucket];
        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfObjects('instanceId', targetBucket.contents, AppConfiguration.currentConfig.designatedItems);
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
            items.push({ item: vaultIntersection[i], char: "-1" });
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
                for (var itemIndex = 0; itemIndex < state.characters[target.id].buckets[ParserUtils.exoticBucketGroups[exoticBucketIndex][bucketIndex]].contents.length; itemIndex++) {
                    var item = state.characters[target.id].buckets[ParserUtils.exoticBucketGroups[exoticBucketIndex][bucketIndex]].contents[itemIndex];
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

    private checkTransferNeeded(state: InventoryManager.InventoryState, target: Character.Character, bucketIndex: Inventory.InventoryBucket, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var intersection = this.intersectArraysOfObjects('instanceId', state.characters[target.id].buckets[bucketIndex].contents, bucketDesignatedItems);
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
            var characters = AppConfiguration.currentConfig.characters;

            // Find all designated items
            var designatedItems = AppConfiguration.currentConfig.designatedItems;
            var designatedBuckets: Inventory.InventoryBucket[] = [];
            var designatedBucketItems: Inventory.InventoryItem[][] = [];
            for (var i = 0; i < designatedItems.length; i++) {
                if (designatedBuckets.indexOf(designatedItems[i].bucket) == -1)
                    designatedBuckets.push(designatedItems[i].bucket);
                if (!(designatedBucketItems[designatedItems[i].bucket]))
                    designatedBucketItems[designatedItems[i].bucket] = [];
                designatedBucketItems[designatedItems[i].bucket].push(designatedItems[i]);
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

                var currentVaultBucket = ParserUtils.getVaultBucketFromGearBucket(currentBucket);
                this.prepForTransfer(currentBucket, currentVaultBucket, target, bucketDesignatedItems, reject);
                this.moveUnequippedItems(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
                this.equipDesignatedItem(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
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