import _ = require('underscore');

import fs = require('fs');
import Membership = require('../bungie-api/api-objects/membership');
import Character = require('../bungie-api/api-objects/character');
import Inventory = require('../bungie-api/api-objects/inventory');
import Armory = require('../bungie-api/armory-api');
import LocalDataStore = require('./local-data-store');
import Errors = require('./errors');
var destiny = require('destiny-client')();

export class AppConfiguration {
    public authMember: Membership.Member;
    public authCookie: string;
    public apiKey: string;
    public csrf: string;

    public debugMode: boolean = false;

    public characters: Character.AliasedCharacter[] = [];
    public designatedItems: Inventory.InventoryItem[] = [];

    public get hasMemberInfo() {
        return !_.isUndefined(this.authMember)
            && !_.isNull(this.authMember)
            && this.authMember instanceof Membership.Member;
    }

    public get hasFullAuthInfo() {
        return this.hasMemberInfo
            && !_.isUndefined(this.authCookie)
            && !_.isUndefined(this.apiKey)
            && !_.isUndefined(this.csrf);
    }

    constructor() {
    }

    public getCharacterFromAlias(alias: string): Character.AliasedCharacter {
        if (alias == null || alias == undefined)
            return null;

        for (var character of this.characters) {
            if (character.alias.toLowerCase() == alias.toLowerCase())
                return character;
        }

        return null;
    }

    public loadMemberInfoFromApi(playerName: string, memberType: Membership.MemberNetworkType): Promise<any> {
        var promise = new Promise((resolve, reject) => {
            // TODO: add catch using other API code
            destiny.Search({
                membershipType: memberType,
                name: playerName
            }).then((result) => {
                this.authMember = Membership.Member.loadFromApiResponse(result[0]);
                resolve();
            });
        });

        return promise;
    }

    public loadDefaultCharactersFromApi() {
        var promise = new Promise((resolve, reject) => {
            this.characters = [];
            // TODO: add catch using other API code
            destiny.Account({
                membershipType: this.authMember.type,
                membershipId: this.authMember.id
            }).then((result) => {
                if (!_.isArray(result.characters)) {
                    reject(new Errors.Exception('API returned invalid result while querying for available characters.'));
                    return;
                }

                (<any[]>result.characters).forEach(characterApiObj => this.characters.push(Character.AliasedCharacter.loadFromApiResponse(characterApiObj)));

                resolve();
            });
        });

        return promise;
    }
}

export class ArmoryCache {
    public itemMetadata: { [itemHash: string]: Armory.ItemArmoryMetadata } = {};

    public getOrLoadItemMetadataForHash(itemHash: string): Promise<Armory.ItemArmoryMetadata> {
        if (!_.isUndefined(this.itemMetadata[itemHash]))
            return Promise.resolve(this.itemMetadata[itemHash]);

        var metadataPromise = Armory.ArmoryApi.loadArmoryMetadataForItemHash(itemHash);
        metadataPromise.then((metadata) => {
            this.itemMetadata[itemHash] = metadata;
            DataStores.armoryCache.save();
        });

        return metadataPromise;
    }
}

export class DataStores {
    public static appConfig: LocalDataStore.LocalDataStore<AppConfiguration>;
    public static armoryCache: LocalDataStore.LocalDataStore<ArmoryCache>;

    private static configPath = './conf.json';
    private static cachePath = './cache.json';

    public static load() {
        this.appConfig = new LocalDataStore.LocalDataStore<AppConfiguration>(this.configPath, AppConfiguration, Inventory.InventoryItem, Inventory.WeaponItem, Inventory.StackableItem, Character.AliasedCharacter, Membership.Member);
        this.appConfig.load();

        this.armoryCache = new LocalDataStore.LocalDataStore<ArmoryCache>(this.cachePath, ArmoryCache, Inventory.InventoryItem, Inventory.WeaponItem, Inventory.StackableItem, Armory.ItemArmoryMetadata);
        this.armoryCache.load();
    }
}