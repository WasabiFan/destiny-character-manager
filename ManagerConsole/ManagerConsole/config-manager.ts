var fs = require('fs');

var configFilePath = 'character-conf.json';
var defaultConfigObj = {
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

var configCache;

exports.load = function () {
    try {
        var configStr = fs.readFileSync(configFilePath);
        configCache = JSON.parse(configStr);
    }
    catch (e) {
        configCache = defaultConfigObj;
        return;
    }
};

exports.save = function () {
    if (configCache == undefined)
        configCache = defaultConfigObj;

    fs.writeFileSync(configFilePath, JSON.stringify(configCache));
}

exports.get = function (name) {
    return configCache[name];
}

exports.set = function (name, property) {
    return configCache[name] = property;
}

exports.load();