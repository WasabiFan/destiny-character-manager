var request = require('request');
var fs = require('fs');
var util = require('util');

var baseApiHeaders = {
    'Cookie': fs.readFileSync('bungie.cookie')
};

var endpointFormat = 'https://www.bungie.net/en/Legend/%s/%d/%d/%d?ajax=true';

exports.loadEndpointHtml = function(endpointUrl, callback) {
    request({
        url: endpointUrl,
        headers: baseApiHeaders
    }, function (shit, moreshit, data) {
        callback(data);
    });
}

exports.buildEndpointStr = function (targetArea, memType, memId, charId) {
    return util.format(endpointFormat, targetArea, memType, memId, charId);
}