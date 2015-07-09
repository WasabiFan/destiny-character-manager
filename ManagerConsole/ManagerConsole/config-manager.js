var fs = require('fs');

var configFilePath = 'character-conf.json';
var defaultConfigObj = {
    bungieCookie: ''
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