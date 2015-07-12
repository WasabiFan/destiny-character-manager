/// <reference path="../Scripts/typings/es6-promise/es6-promise.d.ts" />

var request = require('request');
var fs = require('fs');
var util = require('util');

import Membership = require('./api-objects/membership');
import Character = require('./api-objects/character');
import Configuration = require('../config-manager');

class BungieApiCore {

    private static apiAuthHeaders = {
        'Cookie': Configuration.currentConfig.authCookie,
        'x-api-key': Configuration.currentConfig.apiKey,
        'x-csrf': Configuration.currentConfig.csrf
    };

    private static endpointFormat = 'https://www.bungie.net/en/Legend/%s/%s/%s/%s?ajax=true';

    public static loadEndpointHtml(endpointUrl: string): Promise<string> {
        var opts = {
            url: endpointUrl,
            headers: this.apiAuthHeaders
        };

        var promise = new Promise((resolve, reject) => {

            request(opts, function (shit, moreshit, data) {
                resolve(data);
            });
        });

        return promise;
    }

    public static buildEndpointStr(targetArea, member: Membership.Member, character: Character.Character) {
        return util.format(this.endpointFormat, targetArea, member.type, member.id, character.id);
    }

    public static getAuthHeaders(): any {
        return this.apiAuthHeaders;
    }
}

export = BungieApiCore;