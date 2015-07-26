/// <reference path="../Scripts/typings/cheerio/cheerio.d.ts" />

import cheerio = require('cheerio');
import Bungie = require('./api-core');
import Inventory = require('./api-objects/inventory');
import ParserUtils = require('./parser-utils');
import GearCollection = require('./api-objects/bucket-gear-collection');
import Characters = require('./api-objects/character');
import DataStores = require('../utils/data-stores');

class GearApi {
    private static getItemsFromSinglePage(targetCharacter: Characters.Character, endpointType: GearEndpointType) {
        var targetUrl = Bungie.buildEndpointStr(endpointType == GearEndpointType.Gear ? 'Gear' : 'Inventory', DataStores.DataStores.appConfig.currentData.authMember, targetCharacter);
        var promise = new Promise((resolve, reject) => {
            Bungie.loadEndpointHtml(targetUrl).then(html => {
                var $ = cheerio.load(html);
                var items: Inventory.InventoryItem[] = [];

                $(endpointType == GearEndpointType.Gear ? '.bucket' : '.giantBucket').each((i, bucketElem) => {
                    var bucketCheerio = $(bucketElem);
                    if (endpointType == GearEndpointType.Inventory && bucketCheerio.data('row') != '3')
                        return;

                    var currentBucket = ParserUtils.parseInventoryBucket(bucketCheerio.data('bucketid'));
                    var currentBucketName = ParserUtils.stringifyInventoryBucket(currentBucket);

                    bucketCheerio.find('.bucketItem').each((i, itemElem) => {
                        var itemCheerio = $(itemElem);
                        var newItem = this.loadGearFromCheerio(itemCheerio, currentBucket, endpointType);
                        items.push(newItem);
                    });
                });

                resolve(items);
            }).catch((error) => {
                reject(error);
            });
        });

        return promise;
    }

    public static getItems(targetCharacter: Characters.Character): Promise<GearCollection.BucketGearCollection> {
        var promise = new Promise((resolve, reject) => {
            var gearPromise = this.getItemsFromSinglePage(targetCharacter, GearEndpointType.Gear);
            var inventoryPromise = this.getItemsFromSinglePage(targetCharacter, GearEndpointType.Inventory);
            Promise.all([gearPromise, inventoryPromise]).then((responseArr: Inventory.InventoryItem[][]) => {
                var allItems = responseArr[0].concat(responseArr[1]);
                var buckets = new GearCollection.BucketGearCollection(allItems, targetCharacter);

                resolve(buckets);
            }).catch((error) => {
                reject(error);
            });
        });

        return promise;
    }

    private static loadGearFromCheerio(itemCheerio: Cheerio, currentBucket: Inventory.InventoryBucket, endpointType: GearEndpointType): Inventory.InventoryItem {
        var item: Inventory.InventoryItem = new Inventory.InventoryItem();

        if (ParserUtils.isWeaponBucket(currentBucket)) {
            item = new Inventory.WeaponItem();
            (<Inventory.WeaponItem> item).damageType = ParserUtils.parseDamageType(itemCheerio.find('.destinyTooltip').data('damagetype'));
        }
        else if (ParserUtils.isInventoryBucket(currentBucket)) {
            item = new Inventory.StackableItem();
            var stackSizeDiv = itemCheerio.find('div.stackSize');
            if (stackSizeDiv.length > 0)
                (<Inventory.StackableItem> item).stackSize = parseInt(stackSizeDiv.first().text());
        }

        if (endpointType == GearEndpointType.Gear)
            (<Inventory.GearItem> item).isEquipped = itemCheerio.hasClass('equipped');

        item.name = itemCheerio.find('.itemName').text();
        item.instanceId = itemCheerio.data('iteminstanceid');
        item.itemHash = itemCheerio.data('itemhash');
        item.tier = ParserUtils.parseInventoryItemTier(itemCheerio.find('.tierTypeName').text());
        item.bucket = currentBucket;
        item.type = ParserUtils.parseInventoryItemType(itemCheerio.find('.itemSubtitle').children().first().text());

        return item;
    }
}

enum GearEndpointType {
    Inventory,
    Gear
};

export = GearApi;