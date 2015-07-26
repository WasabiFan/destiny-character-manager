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

    private diffArraysOfObjects(uniqueIdentifierAttributeNames: string[], ...arrays: any[][]) {
        var arr, i, id, j, len, len1, name, obj, objectsById, ref;
        objectsById = {};
        for (i = 0, len = arrays.length; i < len; i++) {
            arr = arrays[i];
            for (j = 0, len1 = arr.length; j < len1; j++) {
                obj = arr[j];
                var matches = true;
                var str = '';
                for (var nameIndex = 0; nameIndex < uniqueIdentifierAttributeNames.length; nameIndex++) {
                    str += (obj[uniqueIdentifierAttributeNames[nameIndex]] + ',') || '';
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
        var checkAttributeNames = ['instanceId', 'itemHash'];
        return this.diffArraysOfObjects(checkAttributeNames, lookupBucketContents, designatedItems);
    }

    private getCharactersFullInfo(state: InventoryManager.InventoryState, currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, target: Character.Character) {
        var characters = DataStores.DataStores.appConfig.currentData.characters;
        // Init return object
        var charsFullInfo = new CharactersFullInfo();

        // Split characters into the target character and the non-target characters
        var charactersPartition = _.partition(characters, (character) => character.id == target.id);
        var targetCharacterIndex = charactersPartition[0][0].id;
        var nonTargets: Character.Character[] = charactersPartition[1];

        // Find which characters are full
        var areCharactersFull = true;
        var charsFull: { [charId: string]: boolean } = {};
        for (var charId in state.characters) {
            if (state.characters[charId].bucketCollection.hasBucket(currentBucket) &&
                ParserUtils.findCapacityForBucket(currentBucket) != state.characters[charId].bucketCollection.getItems(currentBucket).length) {

                areCharactersFull = false;
                charsFull[charId] = false;
            }
            else if (state.characters[charId].bucketCollection.hasBucket(currentBucket))
                charsFull[charId] = true;
            else
                charsFull[charId] = false;
        }
        charsFullInfo.charactersFull = areCharactersFull;
        charsFullInfo.charsFull = charsFull;
        charsFullInfo.targetFull = charsFull[target.id];

        // Find whether the vault is full or if it is empty
        var vaultFull = ParserUtils.findCapacityForBucket(currentVaultBucket) == state.vault.bucketCollection.getItems(currentVaultBucket).length;
        var vaultEmpty = state.vault.bucketCollection.getItems(currentVaultBucket).length == 0;
        charsFullInfo.vaultFull = vaultFull;
        charsFullInfo.vaultEmpty = vaultEmpty;

        // Find which non-targets are full, and record the index of one that is not, if possible
        var nonTargetsFull = true;
        var nonFullNonTargetIndex: number;
        for (var nonTargetIndex = 0; nonTargetIndex < nonTargets.length; nonTargetIndex++)
            if (!charsFull[nonTargets[nonTargetIndex].id]) {
                nonTargetsFull = false;
                nonFullNonTargetIndex = nonTargetIndex;
            }
        charsFullInfo.nonTargetsFull = nonTargetsFull;
        charsFullInfo.nonFullNonTargetIndex = nonFullNonTargetIndex;

        // Return data
        return charsFullInfo;
    }

    private moveAnyItemFromVault(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[], exclude: Inventory.InventoryItem[]) {
        // Get the combined IDs of all the exclude objects
        var excludeStrings = _.map(exclude, (item) => item.instanceId + ',' + item.itemHash);

        var state = this.inventoryMan.currentState;
        var characters = DataStores.DataStores.appConfig.currentData.characters;

        // Get info about how full the characters are
        var fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
        // Array of designated items in the vault
        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(
            state.vault.bucketCollection.getItems(currentVaultBucket),
            DataStores.DataStores.appConfig.currentData.designatedItems);
        // Array of temp items in the vault
        var diff: Inventory.InventoryItem[] = this.findTempItems(
            state.vault.bucketCollection.getItems(currentVaultBucket),
            DataStores.DataStores.appConfig.currentData.designatedItems);

        // TODO: When inventory works on characters, we can do this
        //for (var i = 0; i < diff.length; i++) {
        //    if (diff[i].bucket == Inventory.InventoryBucket.Consumables ||
        //        diff[i].bucket == Inventory.InventoryBucket.Materials)
        //        diff.splice(i, 1);
        //}

        // Move designated item to it's target bucket if it's target bucket is not the current bucket
        // and it's target bucket has space and the item is not excluded
        for (var item of intersection) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(item);
            if (gearBucket != currentBucket &&
                ParserUtils.findCapacityForBucket(gearBucket) !=
                state.characters[targetCharacter.id].bucketCollection.getItems(gearBucket).length &&
                excludeStrings.indexOf(item.instanceId + ',' + item.itemHash) == -1) {

                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, item);
                return;
            }
        }
        // Move temp item to non-target character if there is room in any non-target bucket and the item is not excluded
        for (var item of diff) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(item);
            for (var charId in state.characters) {
                var character = state.characters[charId];
                if (charId == targetCharacter.id)
                    continue;
                if (character.bucketCollection.getItems(gearBucket).length < ParserUtils.findCapacityForBucket(gearBucket) &&
                    excludeStrings.indexOf(item.instanceId + ',' + item.itemHash) == -1) {
                    this.inventoryMan.enqueueMoveOperation(character, false, item);
                    return;
                }
            }
            // If the temp item's bucket is not the current bucket
            // and there is room in the target character's bucket, move the item to the target's bucket
            if (gearBucket != currentBucket &&
                ParserUtils.findCapacityForBucket(gearBucket) > state.characters[targetCharacter.id].bucketCollection.getItems(gearBucket).length &&
                excludeStrings.indexOf(item.instanceId + ',' + item.itemHash) == -1) {
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, item);
                return;
            }
        }
        // If there is room in non-target characters and the items are not excluded, move designated items to them
        for (var item of intersection) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(item);
            for (var charId in state.characters) {
                var character = state.characters[charId];
                if (charId == targetCharacter.id)
                    continue;
                if (gearBucket != currentBucket &&
                    ParserUtils.findCapacityForBucket(gearBucket) > character.bucketCollection.getItems(gearBucket).length &&
                    excludeStrings.indexOf(item.instanceId + ',' + item.itemHash) == -1) {

                    this.inventoryMan.enqueueMoveOperation(character, false, item);
                    return;
                }
            }
        }
        // If there is room in the target bucket, and the item is not excluded, move a temp item to the target bucket
        for (var item of diff) {
            var gearBucket = ParserUtils.getGearBucketForVaultItem(item);
            var character = state.characters[targetCharacter.id]
            if (character.bucketCollection.getItems(gearBucket).length < ParserUtils.findCapacityForBucket(gearBucket) &&
                excludeStrings.indexOf(item.instanceId + ',' + item.itemHash) == -1) {

                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, item);
                return;
            }
        }
        // If there is room in the target bucket, and the item is not excluded, move a designated item into the target bucket
        for (var item of intersection) {
            var character = state.characters[targetCharacter.id];
            if (ParserUtils.getGearBucketForVaultItem(item) == currentBucket &&
                character.bucketCollection.getItems(currentBucket).length < ParserUtils.findCapacityForBucket(currentBucket) &&
                excludeStrings.indexOf(item.instanceId + ',' + item.itemHash) == -1) {

                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, item);
                return;
            }
        }
        // If no items have been moved by now, none can be moved
        throw new Errors.Exception('No items could be removed from the vault');
    }

    private prepForTransfer(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[], reject): Promise<any> {
        var state = this.inventoryMan.currentState;

        // Get info about how full the characters are
        var fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
        // If the vault is full
        if (fullInfo.vaultFull)
            this.moveAnyItemFromVault(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems, [])

        // After that move, refresh our information
        fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
        // Array of designated items in the target bucket
        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(
            state.characters[targetCharacter.id].bucketCollection.getItems(currentBucket),
            DataStores.DataStores.appConfig.currentData.designatedItems);

        // If there is a designated item that is equipped, then we're done
        if (_.some(intersection, (item) => item.getIsEquipped() == true) == true)
            return;
        // Check if an exotic is equipped in the current exotic bucket group
        var exoticEquipped = this.getExoticEquipped(state, currentBucket, targetCharacter).exoticEquipped;
        // Get array of non-exotic designated items in the target bucket
        var nonExoticIntersection = _.reject(intersection, (item) => item.tier == Inventory.InventoryItemTier.Exotic);
        // If there is not an exotic equipped, and there are designated items availiable, equip the first one
        if (exoticEquipped == false && nonExoticIntersection.length > 0)
            this.inventoryMan.enqueueEquipOperation(state.characters[targetCharacter.id], nonExoticIntersection[0]);
    }

    private moveUnequippedItems(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = this.inventoryMan.currentState;
        var characters = DataStores.DataStores.appConfig.currentData.characters;

        // Get the info about how full the characters are
        var fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
        // Array of items that need to be moved
        var items: { item: Inventory.InventoryItem; char: string }[] = [];
        // Loop through non-target characters and add any designated items that are not equipped to items
        _.each(state.characters, (character) => {
            if (character.character.id == targetCharacter.id)
                return;
            var intersection: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(
                character.bucketCollection.getItems(currentBucket),
                DataStores.DataStores.appConfig.currentData.designatedItems);
            items.push.apply(items, _.map(
                _.reject(intersection, (item) => item.getIsEquipped() == false),
                (item) => {
                    return { item: item, char: character.character.id };
                }));
        });
        // Get designated items in the vault with the gear bucket equal to the current bucket
        var vaultIntersection: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(
            state.vault.bucketCollection.getItems(currentVaultBucket),
            bucketDesignatedItems);
        // Add all vaultIntersection items to the items array
        items.push.apply(items, _.map(vaultIntersection, (item) => {
            return { item: item, char: 'vault' };
        }));

        // Move every item in items
        for (var item of items) {
            // Array of designated items at the target bucket
            var targetIntersection: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(
                state.characters[targetCharacter.id].bucketCollection.getItems(currentBucket),
                DataStores.DataStores.appConfig.currentData.designatedItems);
            // If there is not space (a temp item is equipped) unequip it
            if (targetIntersection.length > ParserUtils.findCapacityForBucket(item.item.bucket) - 2)
                this.equipDesignatedItem(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems);
            var isInVault = item.char == 'vault';

            // Get info about how full the characters are
            fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);
            // If the target is full
            if (fullInfo.targetFull) {
                // If the item is not in the vault, move it to the vault
                if (!isInVault)
                    this.inventoryMan.enqueueMoveOperation(state.characters[item.char], true, item.item);
                // Move an item from the vault to make room for two items to pass
                this.moveAnyItemFromVault(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems, [item.item]);
                // Array of temp items in the target bucket
                var temps: Inventory.InventoryItem[] = this.findTempItems(
                    state.characters[targetCharacter.id].bucketCollection.getItems(currentBucket),
                    DataStores.DataStores.appConfig.currentData.designatedItems);
                // Move the first temp item to the vault
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], true, temps[0]);
                // Move the item to the target bucket
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, item.item);
            }
            // If the target is not full, move the item with no complications
            else {
                // If the item is not in the vault, move it there
                if (!isInVault)
                    this.inventoryMan.enqueueMoveOperation(state.characters[item.char], true, item.item);
                // Move the item to the target bucket
                this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], false, item.item);
            }
        }
    }

    private equipDesignatedItem(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = this.inventoryMan.currentState;
        var characters = DataStores.DataStores.appConfig.currentData.characters;

        // Find the list of designated items in the target bucket
        var intersection: Inventory.InventoryItem[] = this.intersectArraysOfInventoryItems(state.characters[targetCharacter.id].bucketCollection.getItems(currentBucket), DataStores.DataStores.appConfig.currentData.designatedItems);
        // If there are no designated items in the target bucket, we cannot equip any
        if (intersection.length == 0)
            return;
        // If there is already a designated item equipped, we don't need to do anything
        if (_.some(intersection, (item) => item.getIsEquipped() == true) == true)
            return;
        // We don't want to equip exotic items, if possible
        var nonExoticIntersection = _.reject(intersection, (item) => item.tier == Inventory.InventoryItemTier.Exotic);
        // If there are items availiable for equip, equip them, then return
        if (nonExoticIntersection.length > 0) {
            this.inventoryMan.enqueueEquipOperation(state.characters[targetCharacter.id], intersection[0]);
            return;
        }

        // If there is no exotic equipped, and no non-exotic can be equipped, equip a designated exotic
        var exoticEquipped = this.getExoticEquipped(state, currentBucket, targetCharacter);
        if (!exoticEquipped && intersection.length > 0) {
            this.inventoryMan.enqueueEquipOperation(state.characters[targetCharacter.id], intersection[0]);
            return;
        }
        else {
            // TODO: Add system to remove equipped exotic if possible
        }
    }

    private getExoticEquipped(state: InventoryManager.InventoryState, bucket: Inventory.InventoryBucket, target: Character.Character) {
        // Loop through exotic bucket groups
        for (var exoticBucketGroup in ParserUtils.exoticBucketGroups) {
            // If the current exotic bucket group does not contain the target bucket, continue
            if (exoticBucketGroup.indexOf(bucket) == -1)
                continue;
            // Loop through exotic buckets
            for (var exoticBucketIndex of exoticBucketGroup) {
                var exoticBucket = state.characters[target.id].bucketCollection.getItems(exoticBucketIndex);
                // Loop through items in the exotic buckets
                for (var item of exoticBucket) {
                    // If an exotic is equipped, return true, along with the exoticBucketIndex
                    if (item.getIsEquipped() == true && item.tier == Inventory.InventoryItemTier.Exotic) {
                        return {
                            'exoticEquipped': true, 'bucketIndex': exoticBucketIndex
                        };
                    }
                }
            }
        }
        // If not true, then return false
        return {
            'exoticEquipped': false
        };
    }

    private moveEquippedItems(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = this.inventoryMan.currentState;
        var characters = DataStores.DataStores.appConfig.currentData.characters;

        var items: { item: Inventory.InventoryItem; char: string }[] = [];
        // Find all designated items in non-target characters that are equipped
        _.each(state.characters, (char) => {
            if (char.character.id == targetCharacter.id)
                return;
            items.push.apply(
                items,
                _.map(
                    _.filter(
                        this.intersectArraysOfInventoryItems(
                            char.bucketCollection.getItems(currentBucket),
                            DataStores.DataStores.appConfig.currentData.designatedItems),
                        item=> item.getIsEquipped() == true),
                    (item) => {
                        return { item: item, char: char.character.id };
                    }));
        });

        for (var item of items) {
            var toEquip: Inventory.InventoryItem;
            if (state.characters[item.char].bucketCollection.getItems(currentBucket).length == 1) {
                // Get a list of temp items in the vault
                var vaultTemps: Inventory.InventoryItem[] = this.findTempItems(state.vault.bucketCollection.getItems(currentVaultBucket), bucketDesignatedItems);
                var vaultTemp;
                // If there are any temp items in the vault
                var acceptableTemps = _.reject(
                    _.filter(
                        vaultTemps,
                        (item) => item.tier == Inventory.InventoryItemTier.Exotic),
                    (item) => ParserUtils.getGearBucketForVaultItem(item) == currentBucket);
                // If not, check to see if there are any temp items in the vault
                var acceptableItems = _.reject(
                    vaultTemps,
                    (item) => ParserUtils.getGearBucketForVaultItem(item) == currentBucket);
                // If there are non-exotic temps in the vault, use the first one
                if (acceptableTemps.length > 0)
                    vaultTemp = acceptableTemps[0];
                // If there are any temps in the vault, use the first one
                else if (vaultTemps.length > 0)
                    vaultTemp = vaultTemps[0];
                // If there are no items in the vault elegible for transfer, then find an item in a non-target character
                else
                    for (var charId in state.characters) {
                        var character = state.characters[charId];
                        var temps: Inventory.InventoryItem[] = this.findTempItems(character.bucketCollection.getItems(currentBucket), DataStores.DataStores.appConfig.currentData.designatedItems);
                        if (temps.length > 0) {
                            // Move that item to the vault for further processing
                            this.inventoryMan.enqueueMoveOperation(character, true, temps[0]);
                            vaultTemp = temps[0]
                        }
                    }

                // Move the item in the vault to the character with the designated item to remove
                this.inventoryMan.enqueueMoveOperation(state.characters[item.char], false, vaultTemp);
                toEquip = vaultTemp;
            }
            // If there are unequipped items in the item's character's current bucket, find the first unequipped item and mark it as toEquip
            else {
                var sourceBucket = state.characters[item.char].bucketCollection.getItems(currentBucket);
                var toEquip = _.reject(sourceBucket, (item) => item.getIsEquipped())[0];
            }
            // Equip toEquip to free up the designated item for removal
            this.inventoryMan.enqueueEquipOperation(state.characters[item.char], toEquip);
        }

        // Now that all equipped designated items have been unequipped, move all unequipped designated items to the target character
        this.moveUnequippedItems(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems);
    }

    private moveTargetTemps(currentBucket: Inventory.InventoryBucket, currentVaultBucket: Inventory.InventoryBucket, targetCharacter: Character.Character, bucketDesignatedItems: Inventory.InventoryItem[]) {
        var state = this.inventoryMan.currentState;
        // Get a list of temp items in the target bucket
        var temps: Inventory.InventoryItem[] = this.findTempItems(state.characters[targetCharacter.id].bucketCollection.getItems(currentBucket), DataStores.DataStores.appConfig.currentData.designatedItems);

        // Loop through the list of temps and remove as many as possible from the target bucket
        for (var temp of temps) {
            // If temp item is equipped after previous processing commands, we cannot remove it
            if (temp.getIsEquipped() == true)
                continue;

            // Gets info about how much space there is to move items into
            var fullInfo = this.getCharactersFullInfo(state, currentBucket, currentVaultBucket, targetCharacter);

            // If the vault is full, but there is still room in non-target characters, then move an item from the vault to a non-target character
            if (fullInfo.vaultFull && !fullInfo.nonTargetsFull) {
                this.moveAnyItemFromVault(currentBucket, currentVaultBucket, targetCharacter, bucketDesignatedItems, []);
            }
            // If the vault is full and all non-target characters 
            else if (fullInfo.vaultFull && fullInfo.nonTargetsFull)
                break;

            this.inventoryMan.enqueueMoveOperation(state.characters[targetCharacter.id], true, temp);
        }
    }

    private checkTransferNeeded(state: InventoryManager.InventoryState, target: Character.Character, bucketIndex: Inventory.InventoryBucket, bucketDesignatedItems: Inventory.InventoryItem[]) {
        // Get the list of designated items in the target bucket
        var intersection = this.intersectArraysOfInventoryItems(state.characters[target.id].bucketCollection.getItems(bucketIndex), bucketDesignatedItems);
        // Check to see if all the designated items and only the designated items are in the target bucket
        if (intersection.length == bucketDesignatedItems.length)
            return false;
        return true;
    }

    public transferDesignatedItems(target: Character.Character) {
        return new Promise((resolve, reject) => {
            // Set class variable so submethods can reject with global errors
            this.promiseParams = { 'resolve': resolve, 'reject': reject };
            // If the inventory is not loaded, no items can be transferred
            if (!this.inventoryMan.isLoaded)
                reject(new Errors.Exception('The inventory must be loaded before transferring items.'));

            var state = this.inventoryMan.currentState;
            var characters = DataStores.DataStores.appConfig.currentData.characters;

            // Find all designated items and designated buckets
            var designatedItems = DataStores.DataStores.appConfig.currentData.designatedItems;
            var designatedBuckets: Inventory.InventoryBucket[] = _.uniq(_.map(designatedItems, (item) => ParserUtils.getGearBucketForVaultItem(item)));
            // Sorts all designated items into buckets
            var designatedItemsByBucket: { [bucket: number]: Inventory.InventoryItem[] } = _.groupBy(designatedItems, (item: Inventory.InventoryItem) => ParserUtils.getGearBucketForVaultItem(item));

            // Ensures that each exotic bucket group has at most one bucket with only exotics equipped
            ParserUtils.exoticBucketGroups.forEach((bucketGroup, index) => {
                var onlyExotics = _.select(bucketGroup, bucket => {
                    var items = designatedItemsByBucket[bucket] || [];
                    return items.length > 0 && _.every(items, item => item.tier === Inventory.InventoryItemTier.Exotic);
                });
                if (onlyExotics.length > 1)
                    reject(new Error('There must be at least three armor buckets and two weapon buckets with non- exotic items in them'));
            });

            // Loop through buckets
            _.each(designatedBuckets, (currentBucket: Inventory.InventoryBucket) => {
                // Ghost shells and subclasses cannot be transferred
                if (currentBucket == Inventory.InventoryBucket.GhostShell || currentBucket == Inventory.InventoryBucket.Subclass)
                    return;

                // Get list of designated items in the current bucket
                var bucketDesignatedItems: Inventory.InventoryItem[] = designatedItemsByBucket[currentBucket];
                // Check if a transfer is needed on this bucket
                var transferNeeded = this.checkTransferNeeded(state, target, currentBucket, bucketDesignatedItems);
                if (transferNeeded == false)
                    return;
                var isInventory = currentBucket == Inventory.InventoryBucket.Materials || currentBucket == Inventory.InventoryBucket.Consumables;

                // Get the vault bucket associated with the current Inventory.InventoryBucket
                var currentVaultBucket = ParserUtils.getVaultBucketFromGearBucket(currentBucket);
                // Execute list of subproccessing commands to effect the transfer
                this.prepForTransfer(currentBucket, currentVaultBucket, target, bucketDesignatedItems, reject);
                this.moveUnequippedItems(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
                this.equipDesignatedItem(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
                // Only try to move equipped items if the bucket is not in inventory
                if (!isInventory)
                    this.moveEquippedItems(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
                this.moveTargetTemps(currentBucket, currentVaultBucket, target, bucketDesignatedItems);
            });

            this.inventoryMan.getCurrentQueueTerminationPromise().then(() => {
                resolve();
            }).catch(reject);
        });
    }
}

class CharactersFullInfo {
    public charactersFull: boolean;
    public charsFull: { [charId: string]: boolean };
    public targetFull: boolean;
    public vaultFull: boolean;
    public vaultEmpty: boolean;
    public nonTargetsFull: boolean;
    public nonFullNonTargetIndex: number;
}

export = InventoryTransferManager;