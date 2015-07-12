import fs = require('fs');
import Membership = require('./bungie-api/api-objects/membership');
import Character = require('./bungie-api/api-objects/character');
import Inventory = require('./bungie-api/api-objects/inventory');

class AppConfiguration {
    private static configFilePath = 'conf.json';

    public static currentConfig: AppConfiguration;

    public authCookie: string;
    public authMember: Membership.Member;

    public characters: Character.AliasedCharacter[] = [];
    public designatedItems: Inventory.InventoryItem[] = [];

    public static load(): AppConfiguration {
        try {
            var configStr = fs.readFileSync(this.configFilePath);
            var jsonVal = JSON.parse(configStr.toString());

            var newConf = new AppConfiguration();
            newConf.authCookie = jsonVal.authCookie;
            newConf.authMember = jsonVal.authMember;
            newConf.characters = jsonVal.characters;
            newConf.designatedItems = jsonVal.designatedItems;

            return newConf;
        }
        catch (e) {
            return new AppConfiguration();
        }
    }

    public save() {
        fs.writeFileSync(AppConfiguration.configFilePath, JSON.stringify(this, null, 4));
    }
}

export = AppConfiguration;

AppConfiguration.currentConfig = AppConfiguration.load();
console.log('Loaded configuration');