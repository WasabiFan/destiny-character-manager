/// <reference path="../Scripts/typings/cheerio/cheerio.d.ts" />

import cheerio = require('cheerio');
import Bungie = require('./api-core');
import Inventory = require('./api-objects/inventory');
import ParserUtils = require('./parser-utils');
import BucketGearCollection = require('./api-objects/bucket-gear-collection');
import Characters = require('./api-objects/character');
import Configuration = require('../config-manager');

class GearApi {
    public static getItems(targetCharacter: Characters.Character): Promise<BucketGearCollection> {
        var gearUrl = Bungie.buildEndpointStr('Gear', Configuration.currentConfig.authMember, targetCharacter);
        var promise = new Promise((resolve, reject) => {
            Bungie.loadEndpointHtml(gearUrl).then(html => {
                var $ = cheerio.load(html);
                var buckets = new BucketGearCollection();

                $('.bucket').each((i, bucketElem) => {
                    var bucketCheerio = $(bucketElem);

                    var currentBucket = ParserUtils.parseInventoryBucket(bucketCheerio.data('bucketid'));
                    var currentBucketName = ParserUtils.stringifyInventoryBucket(currentBucket);

                    bucketCheerio.find('.bucketItem').each((i, itemElem) => {
                        var itemCheerio = $(itemElem);
                        var newItem = this.loadGearFromCheerio(itemCheerio, currentBucket);
                        buckets.addItem(newItem);
                    });
                });

                resolve(buckets);
            });
        });

        return promise;
    }

    private static loadGearFromCheerio(itemCheerio: Cheerio, currentBucket: Inventory.InventoryBucket): Inventory.GearItem {
        var item: Inventory.GearItem = new Inventory.GearItem();

        if (ParserUtils.isWeapon(currentBucket)) {
            item = new Inventory.WeaponItem();
            (<Inventory.WeaponItem> item).damageType = ParserUtils.parseDamageType(itemCheerio.find('.destinyTooltip').data('damagetype'));
        }

        item.isEquipped = itemCheerio.hasClass('equipped');
        item.name = itemCheerio.find('.itemName').text();
        item.instanceId = itemCheerio.data('iteminstanceid');
        item.itemHash = itemCheerio.data('itemhash');
        item.tier = ParserUtils.parseInventoryItemTier(itemCheerio.find('.tierTypeName').text());
        item.bucket = currentBucket;

        return item;
    }
}

export = GearApi;