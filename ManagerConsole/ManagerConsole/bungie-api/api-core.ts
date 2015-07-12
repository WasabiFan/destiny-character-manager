var request = require('request');
var fs = require('fs');
var util = require('util');

import Membership = require('./api-objects/membership');
import Character = require('./api-objects/character');
import Configuration = require('../config-manager');

class BungieApiCore {

    private static baseApiHeaders = {
        'Cookie': Configuration.currentConfig.authCookie
    };

    private static endpointFormat = 'https://www.bungie.net/en/Legend/%s/%s/%s/%s?ajax=true';

    public static loadEndpointHtml(endpointUrl: string, callback: (data: string) => void) {
        request({
            url: endpointUrl,
            headers: this.baseApiHeaders
        }, function (shit, moreshit, data) {
            callback(data);
        });
    }

    public static buildEndpointStr(targetArea, member: Membership.Member, character: Character.Character) {
        return util.format(this.endpointFormat, targetArea, member.type, member.id, character.id);
    }
}

export = BungieApiCore;