require('es6-promise').polyfill();

import Configuration = require('./utils/config-manager');
Configuration.loadCurrentConfig();

import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import Inventory = require('./bungie-api/api-objects/inventory');
import Character = require('./bungie-api/api-objects/character');
import Console = require('./utils/command-console');
import InventoryManager = require('./api-helpers/inventory-manager');
import InventoryTransferManager = require('./api-helpers/inventory-transfer-manager');
import Commands = require('./app-core/destiny-commands');

Configuration.currentConfig.save();

var cmdConsole = new Commands.DestinyCommandConsole();
cmdConsole.start();