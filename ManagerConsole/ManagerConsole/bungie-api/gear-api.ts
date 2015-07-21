/// <reference path="../Scripts/typings/cheerio/cheerio.d.ts" />

import cheerio = require('cheerio');
import Bungie = require('./api-core');
import Inventory = require('./api-objects/inventory');
import ParserUtils = require('./parser-utils');
import BucketGearCollection = require('./api-objects/bucket-gear-collection');
import Characters = require('./api-objects/character');
import Configuration = require('../config-manager');

class GearApi {
    private static getItemsFromSinglePage(targetCharacter: Characters.Character, endpointType: GearEndpointType) {
        var targetUrl = Bungie.buildEndpointStr(endpointType == GearEndpointType.Gear ? 'Gear' : 'Inventory', Configuration.currentConfig.authMember, targetCharacter);
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

    public static getItems(targetCharacter: Characters.Character): Promise<BucketGearCollection> {
        var promise = new Promise((resolve, reject) => {
            var gearPromise = this.getItemsFromSinglePage(targetCharacter, GearEndpointType.Gear);
            var inventoryPromise = this.getItemsFromSinglePage(targetCharacter, GearEndpointType.Inventory);
            Promise.all([gearPromise, inventoryPromise]).then((responseArr: Inventory.InventoryItem[][]) => {
                var buckets = new BucketGearCollection();
                var allItems = responseArr[0].concat(responseArr[1]);
                for (var i in allItems) {
                    buckets.addItem(allItems[i]);
                }

                resolve(buckets);
            }).catch((error) => {
                reject(error);
            });
        });

        return promise;
    }

    private static loadGearFromCheerio(itemCheerio: Cheerio, currentBucket: Inventory.InventoryBucket, endpointType: GearEndpointType): Inventory.GearItem {
        var item: Inventory.GearItem = new Inventory.GearItem();

        if (ParserUtils.isWeapon(currentBucket)) {
            item = new Inventory.WeaponItem();
            (<Inventory.WeaponItem> item).damageType = ParserUtils.parseDamageType(itemCheerio.find('.destinyTooltip').data('damagetype'));
        }

        if (endpointType == GearEndpointType.Gear)
            item.isEquipped = itemCheerio.hasClass('equipped');
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