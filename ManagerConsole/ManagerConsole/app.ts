import Vault = require('./vault-api');
import Gear = require('./gear-api');

Vault.getItems(function (items) {
    console.log(items);
});

Gear.getItems(function (items) {
    console.log(JSON.stringify(items, null, 4));
});