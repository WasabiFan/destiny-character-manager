var cheerio = require('cheerio');
var bungie = require('./api-core.js');

var gearUrl = bungie.buildEndpointStr('Gear', 1, '4611686018428389840', '2305843009217755842');

function findBucketName(bucketId) {
    return bucketId;
}

exports.getItems = function(callback) {
    bungie.loadEndpointHtml(gearUrl, function (html) {
        var $ = cheerio.load(html);
        var buckets = {};

        $('.bucket').each(function (i, bucketElem) {
            var bucketCheerio = $(bucketElem);

            var bucket = findBucketName(bucketCheerio.data('bucketid'));
            var isWeapon = bucket.toLowerCase().indexOf('weapon') != -1;

            buckets[bucket] = [];
            bucketCheerio.find('.bucketItem').each(function (i, itemElem) {
                var itemCheerio = $(itemElem);

                var item = {
                    'equipped': itemCheerio.hasClass('equipped'),
                    'name': itemCheerio.find('.itemName').text(),
                    'instanceId': itemCheerio.data('iteminstanceid'),
                    'hash': itemCheerio.data('itemhash'),
                    'stackSize': itemCheerio.data('stacksize'),
                    'tier': itemCheerio.find('.tierTypeName').text()
                };

                if (isWeapon)
                    item['damageType'] = itemCheerio.find('.destinyTooltip').data('damagetype');

                buckets[bucket].push(item);
            });
        });

        callback(buckets);
    });
}