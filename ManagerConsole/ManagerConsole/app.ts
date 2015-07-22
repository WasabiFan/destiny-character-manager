require('es6-promise').polyfill();

import Configuration = require('./config-manager');
Configuration.loadCurrentConfig();

import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import Inventory = require('./bungie-api/api-objects/inventory');
import Character = require('./bungie-api/api-objects/character');
import Console = require('./command-console');
import InventoryManager = require('./inventory-manager');
import InventoryItemTransferManager = require('./inventory-item-transfer-manager');
import Commands = require('./destiny-commands');

Configuration.currentConfig.save();

var cmdConsole = new Commands.DestinyCommandConsole();
cmdConsole.start();