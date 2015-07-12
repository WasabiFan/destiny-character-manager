/// <reference path="../Scripts/typings/es6-promise/es6-promise.d.ts" />

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

    public static loadEndpointHtml(endpointUrl: string): Promise<string> {
        var promise = new Promise(function (resolve, reject) {
            var opts = {
                url: endpointUrl,
                headers: this.baseApiHeaders
            };

            request(opts, function (shit, moreshit, data) {
                resolve(data);
            });
        });

        return promise;
    }

    public static buildEndpointStr(targetArea, member: Membership.Member, character: Character.Character) {
        return util.format(this.endpointFormat, targetArea, member.type, member.id, character.id);
    }
}

export = BungieApiCore;