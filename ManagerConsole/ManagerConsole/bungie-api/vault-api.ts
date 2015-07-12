/// <reference path="../Scripts/typings/cheerio/cheerio.d.ts" />

import cheerio = require('cheerio');
import Bungie = require('./api-core');
import Inventory = require('./api-objects/inventory');
import ParserUtils = require('./parser-utils');
import BucketGearCollection = require('./api-objects/bucket-gear-collection');
import Characters = require('./api-objects/character');
import Configuration = require('../config-manager');

class VaultApi {
    public static getItems(targetCharacter: Characters.Character): Promise<Inventory.InventoryItem[]> {
        var vaultUrl: string = Bungie.buildEndpointStr('VaultSidebar', Configuration.currentConfig.authMember, targetCharacter);
        var promise = new Promise(function (resolve, reject) {
            Bungie.loadEndpointHtml(vaultUrl).then((html) => {
                var items = [];

                var $ = cheerio.load(html);
                $('.sidebarItem.inVault').each((i, element) => {
                    var cheerioItem = $(this);
                    var itemInfo = this.loadVaultItemFromCheerio(cheerioItem);

                    items.push(itemInfo);
                });

                resolve(items);
            });
        });

        return promise;
    }

    private static loadVaultItemFromCheerio(itemCheerio: Cheerio): Inventory.InventoryItem {
        var newItem: Inventory.InventoryItem;

        switch (itemCheerio.parent().prev().text()) {
            case 'Stored Weapons':
                newItem = new Inventory.WeaponItem();
                newItem.bucket = Inventory.InventoryBucket.VaultWeapon;

                (<Inventory.WeaponItem> newItem).damageType = ParserUtils.parseDamageType(itemCheerio.data('damagetype'));
            case 'Stored Armor':
                if (newItem == undefined)
                    newItem = new Inventory.GearItem();

                newItem.bucket = Inventory.InventoryBucket.VaultArmor;
                (<Inventory.GearItem> newItem).isEquipped = false;
                break;
            case 'General':
                newItem = new Inventory.StackableItem();
                newItem.bucket = Inventory.InventoryBucket.VaultGeneral;
                (<Inventory.StackableItem> newItem).stackSize = parseInt(itemCheerio.data('stacksize'));
                break;
        }

        newItem.instanceId = itemCheerio.data('iteminstanceid');
        newItem.itemHash = itemCheerio.data('itemhash');
        newItem.name = itemCheerio.children('.label').children('span').text();
        newItem.type = ParserUtils.parseInventoryItemType(itemCheerio.children('.subtitle').text());
        newItem.tier = Inventory.InventoryItemTier.Unknown;

        return newItem;
    }
}

export = VaultApi;