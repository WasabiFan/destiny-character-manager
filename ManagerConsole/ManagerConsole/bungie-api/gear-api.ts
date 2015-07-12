/// <reference path="../Scripts/typings/cheerio/cheerio.d.ts" />

import cheerio = require('cheerio');
import Bungie = require('./api-core');
import Inventory = require('./api-objects/inventory');
import ParserUtils = require('./parser-utils');
import BucketGearCollection = require('./api-objects/bucket-gear-collection');
import Characters = require('./api-objects/character');
import Configuration = require('../config-manager');

class GearApi {
    public static getItems(targetCharacter: Characters.Character, callback: (buckets: BucketGearCollection) => void) {
        var gearUrl = Bungie.buildEndpointStr('Gear', Configuration.currentConfig.authMember, targetCharacter);

        Bungie.loadEndpointHtml(gearUrl, html => {
            var $ = cheerio.load(html);
            var buckets = new BucketGearCollection();

            $('.bucket').each((i, bucketElem) => {
                var bucketCheerio = $(bucketElem);

                var currentBucket = ParserUtils.parseGearBucket(bucketCheerio.data('bucketid'));
                var currentBucketName = ParserUtils.stringifyGearBucket(currentBucket);
                
                bucketCheerio.find('.bucketItem').each((i, itemElem) => {
                    var itemCheerio = $(itemElem);
                    var newItem = this.loadGearFromCheerio(itemCheerio, currentBucket);
                    buckets.addItem(newItem);
                });
            });

            callback(buckets);
        });
    }

    private static loadGearFromCheerio(itemCheerio: Cheerio, currentBucket: Inventory.GearBucket): Inventory.GearItem {
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