require('es6-promise').polyfill();

import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import Inventory = require('./bungie-api/api-objects/inventory');
import Configuration = require('./config-manager');
import Console = require('./command-console');
import ManagementQueue = require('./inventory-management-queue');

//Vault.getItems(function (items) {
//    console.log(items);
//});

//Gear.getItems(function (items) {
//    console.log(JSON.stringify(items, null, 4));
//});

Configuration.currentConfig.save();
console.log('Saved configuration');

var consoleConfig = new Console.CommandConsoleOptions();

var commandB = new Console.Command('b', (...args: string[]) => {
    console.log('B command run with args: ' + args);
});

var commandC = new Console.Command('c',(...args: string[]) => {
    console.log('C command run with args: ' + args);
});

consoleConfig.commandRoot = new Console.Command('a', [commandB, commandC]);
var cmdConsole = new Console.CommandConsole(consoleConfig);
cmdConsole.start();

var queue = new ManagementQueue.InventoryManagementQueue();
queue.loadState().then(function (a) {
    var state = queue.getCurrentState();

    queue.addMoveOperationToQueue(state.characters[2], true, Configuration.currentConfig.designatedItems[0]);
    queue.addMoveOperationToQueue(state.characters[2], false, Configuration.currentConfig.designatedItems[0]);
    queue.addMoveOperationToQueue(state.characters[2], true, Configuration.currentConfig.designatedItems[0]);
    queue.addMoveOperationToQueue(state.characters[2], false, Configuration.currentConfig.designatedItems[0]);
    queue.addMoveOperationToQueue(state.characters[2], true, Configuration.currentConfig.designatedItems[0]);
    queue.addMoveOperationToQueue(state.characters[2], false, Configuration.currentConfig.designatedItems[0]);
}, function (a) {
        console.log('fuck' + a);
});