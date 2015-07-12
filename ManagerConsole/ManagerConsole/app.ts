import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import Configuration = require('./config-manager');

//Vault.getItems(function (items) {
//    console.log(items);
//});

//Gear.getItems(function (items) {
//    console.log(JSON.stringify(items, null, 4));
//});

Configuration.currentConfig.save();
console.log('Saved configuration');