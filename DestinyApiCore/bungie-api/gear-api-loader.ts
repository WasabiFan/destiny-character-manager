/// <reference path="../Scripts/typings/cheerio/cheerio.d.ts" />

import cheerio = require('cheerio');
import Bungie = require('./api-core-utils');
import Inventory = require('./api-objects/inventory');
import ParserUtils = require('./parser-utils');
import GearCollection = require('./api-objects/bucket-gear-collection');
import Characters = require('./api-objects/character');
import Membership = require('./api-objects/membership');
import Caches = require('../api-helpers/caches');

class GearApi {
    private static getItemsFromSinglePage(targetCharacter: Characters.Character, targetMember: Membership.Member, endpointType: GearEndpointType, authHeaders: any, cache: Caches.FileObjectCache<Caches.BungieApiCacheData>) {
        var targetUrl = Bungie.buildEndpointStr(endpointType == GearEndpointType.Gear ? 'Gear' : 'Inventory', targetMember, targetCharacter);
        var promise = new Promise((resolve, reject) => {
            Bungie.loadEndpointHtml(targetUrl, authHeaders).then(html => {
                var armoryPromises: Promise<any>[] = [];

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
                        armoryPromises.push(cache.currentData.getOrLoadItemMetadataForHash(newItem.itemHash).then(metadata => {
                            if (newItem instanceof Inventory.ArmorItem)
                                (<Inventory.ArmorItem>newItem).class = metadata.class;

                            items.push(newItem);
                        }));
                    });
                });

                Promise.all(armoryPromises).then(() => {
                    resolve(items);
                }).catch(error => {
                    reject(error);
                });
            }).catch((error) => {
                reject(error);
            });
        });

        return promise;
    }

    public static getItems(targetCharacter: Characters.Character, targetMember: Membership.Member, authHeaders: any, cache: Caches.FileObjectCache<Caches.BungieApiCacheData>): Promise<GearCollection.BucketGearCollection> {
        var promise = new Promise((resolve, reject) => {
            var gearPromise = this.getItemsFromSinglePage(targetCharacter, targetMember, GearEndpointType.Gear, authHeaders, cache);
            var inventoryPromise = this.getItemsFromSinglePage(targetCharacter, targetMember, GearEndpointType.Inventory, authHeaders, cache);
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
        else if (ParserUtils.isArmorBucket(currentBucket)) {
            item = new Inventory.ArmorItem();
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