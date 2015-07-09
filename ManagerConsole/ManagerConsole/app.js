var https = require('https');
var cheerio = require('cheerio');
var request = require('request');
var fs = require('fs');

var baseApiHeaders = {
    'Cookie': fs.readFileSync('bungie.cookie')
};

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

getVaultItems(function (items) {
    console.log(items);
});