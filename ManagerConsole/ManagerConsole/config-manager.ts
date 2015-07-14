﻿import fs = require('fs');
import Membership = require('./bungie-api/api-objects/membership');
import Character = require('./bungie-api/api-objects/character');
import Inventory = require('./bungie-api/api-objects/inventory');

class AppConfiguration {
    private static configFilePath = 'conf.json';

    public static currentConfig: AppConfiguration;

    public authCookie: string;
    public authMember: Membership.Member;
    public apiKey: string;
    public csrf: string;

    public characters: Character.AliasedCharacter[] = [];
    public designatedItems: Inventory.InventoryItem[] = [];

    public static load(): AppConfiguration {
        try {
            var configStr = fs.readFileSync(this.configFilePath);
            var jsonVal = JSON.parse(configStr.toString());

            return AppConfiguration.loadFromPlain(jsonVal);
        }
        catch (e) {
            return new AppConfiguration();
        }
    }

    public static loadFromPlain(plainObj: any): AppConfiguration {
        var newConf = new AppConfiguration();
        newConf.authCookie = plainObj.authCookie;
        newConf.authMember = Membership.Member.loadFromPlain(plainObj.authMember);
        newConf.apiKey = plainObj.apiKey;
        newConf.csrf = plainObj.csrf;

        newConf.characters = [];
        for (var i in plainObj.characters)
            newConf.characters[i] = Character.AliasedCharacter.loadFromPlain(plainObj.characters[i]);

        newConf.designatedItems = [];
        for (var i in plainObj.designatedItems)
            newConf.designatedItems[i] = Inventory.InventoryItem.loadFromPlain(plainObj.designatedItems[i]);

        return newConf;
    }

    public save() {
        fs.writeFileSync(AppConfiguration.configFilePath, JSON.stringify(this, null, 4));
    }

    public getCharacterFromAlias(alias: string): Character.AliasedCharacter {
        if (alias == null || alias == undefined)
            return null;
        
        for (var i in this.characters) {
            if (this.characters[i].alias.toLowerCase() == alias.toLowerCase())
                return this.characters[i];
        }

        return null;
    }
}

export = AppConfiguration;

AppConfiguration.currentConfig = AppConfiguration.load();
console.log('Loaded local configuration');