var https = require('https');
var cheerio = require('cheerio');
var request = require('request');
var fs = require('fs');

var baseApiHeaders = {
    'Cookie': fs.readFileSync('bungie.cookie')
};

var gearUrl = 'https://www.bungie.net/en/Legend/Gear/1/4611686018428389840/2305843009217755842?ajax=true';
var vaultSidebarUrl = 'https://www.bungie.net/en/Legend/VaultSidebar/1/4611686018428389840/2305843009217755842?ajax=true';

function loadBungieEndpointHtml(endpointUrl, callback) {
    request({
        url: endpointUrl,
        headers: baseApiHeaders
    }, function (shit, moreshit, data) {
        callback(data);
    });
}

function getVaultItems(callback) {
    loadBungieEndpointHtml(vaultSidebarUrl, function (html) {
        var items = [];
        
        var $ = cheerio.load(html);
        $('.sidebarItem.inVault').each(function (i, element) {
            var cheerio = $(this);
            
            var itemInfo = {
                instanceId: cheerio.data('iteminstanceid'),
                hash: cheerio.data('itemhash'),
                stackSize: cheerio.data('stacksize'),
                damageType: cheerio.data('damagetype'),
                name: cheerio.children('.label').children('span').text(),
                specificType: cheerio.children('.subtitle').text(),
                category: cheerio.parent().prev().text()
            };
            
            items.push(itemInfo);
        });
        
        callback(items);
    });
}

function getGearItems(callback) {
    loadBungieEndpointHtml(gearUrl, function (html) {
        var $ = cheerio.load(html);
        var buckets = {};
        var bucketsJq = $('.bucket');
        for (var i = 0; i < bucketsJq.length; i++) {
            var bucket = bucketsJq.eq(i).data('bucketid').replace('BUCKET_', '').replace('_', ' ').toLowerCase();
            var isWeapon = bucket.indexOf('weapon') != -1;
            var bucketJq = bucketsJq.eq(i);
            buckets[bucket] = [];
            var itemsJq = bucketJq.find('.bucketItem');
            for (var j = 0; j < itemsJq.length; j++) {
                var itemJq = itemsJq.eq(j);
                var item = {
                    'equipped': itemJq.hasClass('equipped'),
                    'name': itemJq.find('.itemName').text(),
                    'instanceId': itemJq.data('iteminstanceid'),
                    'hash': itemJq.data('itemhash'),
                    'stackSize': itemJq.data('stacksize'),
                    'tier': itemJq.find('.tierTypeName').text()
                };
                if (isWeapon)
                    item['damageType'] = itemJq.find('.destinyTooltip').data('damagetype');
                buckets[bucket].push(item);
            }
        }
        callback(buckets);
    });
}

getVaultItems(function (items) {
    console.log(items);
});
getGearItems(function (items) {
    console.log(JSON.stringify(items, null, 4));
});