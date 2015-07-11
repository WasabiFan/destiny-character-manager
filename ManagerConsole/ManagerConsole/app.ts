/// <require path="./gear.ts" />
/// <require path="./vault.ts" />

var gear: GearApi = new (require('./gear.js').GearApi)();
var vault: VaultApi = new (require('./vault.js').VaultApi)();

vault.getItems(function (items) {
    console.log(items);
});

gear.getItems(function (items) {
    console.log(JSON.stringify(items, null, 4));
});