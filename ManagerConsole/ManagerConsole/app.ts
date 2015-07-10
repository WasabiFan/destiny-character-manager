var gear = require('./gear.js');
var vault = require('./vault.js');


vault.getItems(function (items) {
    console.log(items);
});

gear.getItems(function (items) {
    console.log(JSON.stringify(items, null, 4));
});