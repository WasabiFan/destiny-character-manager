/// <require path="./api-core.ts" />

var cheerio = require('cheerio');
var bungie: BungieApiCore = new (require('./api-core.js').BungieApiCore)();

class VaultApi {

    private vaultUrl: string = bungie.buildEndpointStr('VaultSidebar', 1, '4611686018428389840', '2305843009217755842');

    public getItems(callback) {
        bungie.loadEndpointHtml(this.vaultUrl, function (html) {
            var items = [];
        
            var $ = cheerio.load(html);
            $('.sidebarItem.inVault').each(function (i, element) {
                var cheerioItem = $(this);
            
                var itemInfo = {
                    instanceId: cheerioItem.data('iteminstanceid'),
                    hash: cheerioItem.data('itemhash'),
                    stackSize: cheerioItem.data('stacksize'),
                    damageType: cheerioItem.data('damagetype'),
                    name: cheerioItem.children('.label').children('span').text(),
                    specificType: cheerioItem.children('.subtitle').text(),
                    category: cheerioItem.parent().prev().text()
                };
            
                items.push(itemInfo);
            });
        
            callback(items);
        });
    }
}

exports.VaultApi = VaultApi;