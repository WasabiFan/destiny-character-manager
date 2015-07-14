import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import Inventory = require('./bungie-api/api-objects/inventory');
import Character = require('./bungie-api/api-objects/character');
import Configuration = require('./config-manager');
import Console = require('./command-console');
import InventoryManager = require('./inventory-manager');
import InventoryItemTransferManager = require('./inventory-item-transfer-manager');
import Filters = require('./filters');
import Table = require('easy-table');
import Chalk = require('chalk');

export class DestinyCommandConsole {
    private console: Console.CommandConsole;
    private consoleOptions: Console.CommandConsoleOptions;
    private inventoryManager: InventoryManager.InventoryManager;

    constructor() {
        this.consoleOptions = new Console.CommandConsoleOptions();
        this.consoleOptions.commandRoot = new Console.Command(null, [
            new Console.Command('set', this.setAction.bind(this)),
            new Console.Command('list', this.listAction.bind(this)),
            new Console.Command('parse', this.testFilterAction.bind(this)),
            new Console.Command('mark', this.markAction.bind(this)),
            new Console.Command('umark', this.unmarkAction.bind(this)),
            new Console.Command('unmark', this.unmarkAction.bind(this)),
            new Console.Command('move-marks', this.transferAction.bind(this)),
        ]);
    }

    public start() {
        this.inventoryManager = new InventoryManager.InventoryManager();
        this.inventoryManager.loadState().then(() => {
            this.console = new Console.CommandConsole(this.consoleOptions);
            this.console.start();
        });
    }

    private setAction(fullArgs: string, propName: string, propValue: string) {
        propName = propName.toLowerCase();
        var wholeVal = fullArgs.substring(fullArgs.indexOf(' ') + 1);

        switch (propName) {
            case 'cookie':
                Configuration.currentConfig.authCookie = wholeVal;
                break;
            case 'gamertag':
                // TODO: do lookup
                break;
        }
    }

    private listAction(fullArgs: string, characterAlias: string, filterStr: string) {
        var targetCharacter = Configuration.currentConfig.getCharacterFromAlias(characterAlias);

        if (targetCharacter == null) {
            console.log('Invalid character alias: ' + characterAlias);
            return;
        }

        var filter = new Filters.InventoryFilter(filterStr);
        var filteredItems = filter.findMatchesInCollection(this.inventoryManager.getAllCharacterItems(targetCharacter));

        var resultTable = new Table();

        for (var i in filteredItems) {
            var chalkChain = [];

            switch (filteredItems[i].bucket) {
                case Inventory.InventoryBucket.PrimaryWeapon:
                    chalkChain.push('white');
                    break;
                case Inventory.InventoryBucket.SpecialWeapon:
                    chalkChain.push('green');
                    break;
                case Inventory.InventoryBucket.HeavyWeapon:
                    chalkChain.push('magenta');
                    break;
                case Inventory.InventoryBucket.Helmet:
                    chalkChain.push('cyan');
                    break;
                case Inventory.InventoryBucket.Gauntlets:
                    chalkChain.push('blue');
                    break;
                case Inventory.InventoryBucket.ChestArmor:
                    chalkChain.push('yellow');
                    break;
                case Inventory.InventoryBucket.LegArmor:
                    chalkChain.push('red');
                    break;
            }

            var chalkify: any = Chalk.gray;
            for (var chalkIndex in chalkChain) {
                chalkify = chalkify[chalkChain[chalkIndex]];
            }

            resultTable.cell('', chalkify('█'));
            resultTable.cell('Name', filteredItems[i].name);
            resultTable.cell('Tier', Inventory.InventoryItemTier[filteredItems[i].tier]);
            resultTable.cell('Type', Inventory.InventoryItemType[filteredItems[i].type]);
            resultTable.cell('Equipped?', filteredItems[i].getIsEquipped() == true ? '█' : '');
            // TODO: designated
            resultTable.newRow();
        }

        console.log(resultTable.toString());
    }

    private testFilterAction(fullArgs: string) {
        var filterObj = new Filters.InventoryFilter(fullArgs);

        var tierStrs = [];
        for (var i in filterObj.tiers)
            tierStrs.push(Inventory.InventoryItemTier[filterObj.tiers[i]]);

        var bucketStrs = [];
        for (var i in filterObj.buckets)
            bucketStrs.push(Inventory.InventoryBucket[filterObj.buckets[i]]);

        console.log('Tiers:  ' + (tierStrs.length > 0 ? tierStrs.join(', ') : 'All'));
        console.log('Buckets:  ' + (bucketStrs.length > 0 ? bucketStrs.join(', ') : 'All'));
    }

    private transferAction(fullArgs: string, characterAlias: string) {
        var targetCharacter = Configuration.currentConfig.getCharacterFromAlias(characterAlias);
        if (targetCharacter == null) {
            console.log('Invalid character alias: ' + characterAlias);
            return;
        }

        InventoryItemTransferManager.transferDesignatedItems(targetCharacter);
    }

    private markAction(fullArgs: string, characterAlias: string, filterStr: string) {
        var filter = new Filters.InventoryFilter(filterStr);
        this.inventoryManager.applyFilterToDesignatedItems(characterAlias, filter, Filters.FilterMode.Add);
        Configuration.currentConfig.save();
    }

    private unmarkAction(fullArgs: string, filterStr: string) {
        var filter = new Filters.InventoryFilter(filterStr);
        this.inventoryManager.applyFilterToDesignatedItems(undefined, filter, Filters.FilterMode.Remove);
        Configuration.currentConfig.save();
    }
}