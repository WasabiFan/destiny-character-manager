var request = require('request');
var fs = require('fs');
var util = require('util');

class BungieApiCore {

    private static baseApiHeaders = {
        'Cookie': fs.readFileSync('bungie.cookie')
    };

    private static endpointFormat = 'https://www.bungie.net/en/Legend/%s/%s/%s/%s?ajax=true';

    public static loadEndpointHtml(endpointUrl, callback) {
        request({
            url: endpointUrl,
            headers: this.baseApiHeaders
        }, function (shit, moreshit, data) {
            callback(data);
        });
    }

    public static buildEndpointStr(targetArea, memType, memId, charId) {
        return util.format(this.endpointFormat, targetArea, memType, memId, charId);
    }
}

export = BungieApiCore;