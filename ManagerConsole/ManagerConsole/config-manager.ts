var fs = require('fs');

class ConfigManager {
    private static configFilePath = 'character-conf.json';
    private static defaultConfigObj = {
        auth: {
            cookie: undefined,
            memId: undefined,
            memType: 1
        },
        chars: [
            //{
            //    alias: '',
            //    class: 1,
            //    charId: 8
            //}
        ],
        designatedItems: {
            //primaryWeapon: [
            //    {...}
            //]
        }
    }

    private static configCache;

    public static load() {
        try {
            var configStr = fs.readFileSync(this.configFilePath);
            this.configCache = JSON.parse(configStr);
        }
        catch (e) {
            this.configCache = this.defaultConfigObj;
            return;
        }
    }

    public static save = function () {
        if (this.configCache == undefined)
            this.configCache = this.defaultConfigObj;

        fs.writeFileSync(this.configFilePath, JSON.stringify(this.configCache));
    }

    public static get = function (name: string) {
        return this.configCache[name];
    }

    public static set = function (name, property) {
        return this.configCache[name] = property;
    }
}

export = ConfigManager;
ConfigManager.load();