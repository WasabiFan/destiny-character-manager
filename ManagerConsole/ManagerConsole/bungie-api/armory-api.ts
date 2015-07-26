/// <reference path="../Scripts/typings/cheerio/cheerio.d.ts" />

import cheerio = require('cheerio');
import Bungie = require('./api-core');
import Inventory = require('./api-objects/inventory');
import ParserUtils = require('./parser-utils');
import GearCollection = require('./api-objects/bucket-gear-collection');
import Characters = require('./api-objects/character');
import DataStores = require('../utils/data-stores');
import _ = require('underscore');

export class ArmoryApi {
    private static classCategoryBase = '/en/Armory/Category?categories=20%2C';
    private static classCategoryTable: { [classcode: string]: Characters.CharacterClass } = {
        '21': Characters.CharacterClass.Warlock,
        '22': Characters.CharacterClass.Titan,
        '23': Characters.CharacterClass.Hunter
    }

    public static loadArmoryMetadataForItemHash(itemHash: string): Promise<ItemArmoryMetadata> {
        var promise = new Promise((resolve, reject) => {
            Bungie.loadEndpointHtml('https://www.bungie.net/en/Armory/Detail', {
                item: itemHash
            }).then((pageHtml: string) => {
                var $ = cheerio.load(pageHtml);
                var metadata = new ItemArmoryMetadata();

                var titleStr = $("meta[property='og:title']").attr('content');
                metadata.tier = this.parseTierFromTitleStr(titleStr);
                metadata.class = this.parseClassFromBreadcrumb($('.contentWrapper_armory .breadcrumb'), $);

                resolve(metadata);
            }).catch((errorData) => {
                reject(errorData);
            });
        });

        return promise;
    }

    private static parseTierFromTitleStr(titleStr: string): Inventory.InventoryItemTier {
        var tierRegex = /-\s*([Ee]xotic|[Ll]egendary|[Rr]are|[Uu]ncommon|[Cc]ommon)\s*-/;
        var matches = tierRegex.exec(titleStr);

        if (matches == null)
            return Inventory.InventoryItemTier.Unknown;

        var tierStr = matches[1];
        return ParserUtils.parseInventoryItemTier(tierStr);
    }

    private static parseClassFromBreadcrumb(breadcrumb: Cheerio, $: CheerioStatic): Characters.CharacterClass {
        var classLinks = breadcrumb.children('a[href^="' + this.classCategoryBase + '"]');
        var classLinkHrefs = _.map(classLinks, item => $(item).attr('href'));
        var firstClassLinkHref = _.first(classLinkHrefs);

        if (_.isUndefined(firstClassLinkHref))
            return Characters.CharacterClass.Unknown;

        return this.classCategoryTable[firstClassLinkHref.substring(this.classCategoryBase.length)];
    }
}

export class ItemArmoryMetadata {
    public tier: Inventory.InventoryItemTier;
    public class: Characters.CharacterClass;
}