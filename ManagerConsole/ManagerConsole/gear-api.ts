/// <reference path="Scripts/typings/cheerio/cheerio.d.ts" />

import cheerio = require('cheerio');
import Bungie = require('./api-core');
import Inventory = require('./inventory-item');
import ParserUtils = require('./parser-utils');
import BucketGearCollection = require('./bucket-gear-collection');

class GearApi {

    private static gearUrl = Bungie.buildEndpointStr('Gear', 1, '4611686018428389840', '2305843009217755842');

    public static getItems(callback: (buckets: BucketGearCollection) => any) {
        Bungie.loadEndpointHtml(this.gearUrl, html => {
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
            var weapon = new Inventory.WeaponItem();
            weapon.damageType = ParserUtils.parseDamageType(itemCheerio.find('.destinyTooltip').data('damagetype'));
            item = weapon;
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