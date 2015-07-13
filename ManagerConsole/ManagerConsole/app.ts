require('es6-promise').polyfill();

import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import Inventory = require('./bungie-api/api-objects/inventory');
import Character = require('./bungie-api/api-objects/character');
import Configuration = require('./config-manager');
import Console = require('./command-console');
import ManagementQueue = require('./inventory-management-queue');
import InventoryItemTransferManager = require('./inventory-item-transfer-manager');
import Commands = require('./destiny-commands');

//Vault.getItems(function (items) {
//    console.log(items);
//});

//Gear.getItems(function (items) {
//    console.log(JSON.stringify(items, null, 4));
//});

Configuration.currentConfig.save();
console.log('Saved configuration');

//InventoryItemTransferManager.transferDesignatedItems(Configuration.currentConfig.characters[0]);

var cmdConsole = new Commands.DestinyCommandConsole();
cmdConsole.start();

//var consoleConfig = new Console.CommandConsoleOptions();

//var commandB = new Console.Command('b', (...args: string[]) => {
//    console.log('B command run with args: ' + args);
//});

//var commandC = new Console.Command('c',(...args: string[]) => {
//    console.log('C command run with args: ' + args);
//});

//consoleConfig.commandRoot = new Console.Command('a', [commandB, commandC]);
//var cmdConsole = new Console.CommandConsole(consoleConfig);
//cmdConsole.start();

//var queue = new ManagementQueue.InventoryManagementQueue();
//queue.loadState().then(function (a) {
//    var state = queue.getCurrentState();

//    var targetCharacter: ManagementQueue.CharacterInventoryState;
//    for (var i in state.characters) {
//        if (state.characters[i].character.characterClass == Character.CharacterClass.Warlock)
//            targetCharacter = state.characters[i];
//    }

//    //queue.enqueueEquipOperation(targetCharacter, Configuration.currentConfig.designatedItems[0]);

//    queue.enqueueMoveOperation(targetCharacter, true, Configuration.currentConfig.designatedItems[0]);
//    queue.enqueueMoveOperation(targetCharacter, false, Configuration.currentConfig.designatedItems[0]);
//    queue.enqueueMoveOperation(targetCharacter, true, Configuration.currentConfig.designatedItems[0]);
//    queue.enqueueMoveOperation(targetCharacter, false, Configuration.currentConfig.designatedItems[0]);
//    queue.enqueueMoveOperation(targetCharacter, true, Configuration.currentConfig.designatedItems[0]);
//    queue.enqueueMoveOperation(targetCharacter, false, Configuration.currentConfig.designatedItems[0]);
//}, function (a) {
//        console.log('Error thrown while loading queue! ' + a);
//});
setInterval(() => { }, 500000);