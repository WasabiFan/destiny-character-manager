﻿/// <reference path="../Scripts/typings/es6-promise/es6-promise.d.ts" />
/// <reference path="../Scripts/typings/underscore/underscore.d.ts" />

import fs = require('fs');
import util = require('util');
import url = require('url');
var request = require('request');
import _ = require('underscore');

import Membership = require('./api-objects/membership');
import Character = require('./api-objects/character');
import DataStores = require('../utils/data-stores');
import Errors = require('../utils/errors');

class BungieApiCore {
    private static endpointFormat = 'https://www.bungie.net/en/Legend/%s/%s/%s/%s?ajax=true';

    public static loadEndpointHtml(endpointUrl: string, queryParams?: any): Promise<string> {

        if (queryParams != undefined) {
            var urlObj = url.parse(endpointUrl, true);
            urlObj.query = _.extend({}, queryParams, urlObj.query);

            // Delete this so that "format" looks at "query": http://stackoverflow.com/questions/7517332/node-js-url-parse-result-back-to-string
            delete urlObj.search;

            endpointUrl = url.format(urlObj);
        }

        var opts = {
            url: endpointUrl,
            headers: this.getAuthHeaders()
        };

        var promise = new Promise<string>((resolve, reject) => {

            // TODO: Figure out these extra params 
            request(opts, (__, ___, data) => {
                if (data == undefined) {
                    reject(new Errors.Exception('No result returned from call to load from endpoint "' + endpointUrl + '". Check to make sure that you are connected to the internet.'));
                    return;
                }

                resolve(data);
            });
        });

        return promise;
    }

    public static buildEndpointStr(targetArea, member: Membership.Member, character: Character.Character) {
        return util.format(this.endpointFormat, targetArea, member.type, member.id, character.id);
    }

    public static getAuthHeaders(): any {
        return {
            'Cookie': DataStores.DataStores.appConfig.currentData.authCookie,
            'x-api-key': DataStores.DataStores.appConfig.currentData.apiKey,
            'x-csrf': DataStores.DataStores.appConfig.currentData.csrf
        };
    }
}

export = BungieApiCore;