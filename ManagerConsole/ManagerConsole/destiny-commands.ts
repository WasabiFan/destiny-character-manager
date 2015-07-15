﻿import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import Inventory = require('./bungie-api/api-objects/inventory');
import Character = require('./bungie-api/api-objects/character');
import Configuration = require('./config-manager');
import Console = require('./command-console');
import InventoryManager = require('./inventory-manager');
import InventoryItemTransferManager = require('./inventory-item-transfer-manager');
import Filters = require('./filters');
import ParserUtils = require('./bungie-api/parser-utils');
import Table = require('easy-table');
import Chalk = require('chalk');
var package = require('./package.json');

export class DestinyCommandConsole {
    private console: Console.CommandConsole;
    private consoleOptions: Console.CommandConsoleOptions;
    private inventoryManager: InventoryManager.InventoryManager;
    private transferMan: InventoryItemTransferManager;

    constructor() {
        this.consoleOptions = new Console.CommandConsoleOptions();
        this.consoleOptions.commandRoot = new Console.Command(null, [
            // TODO: Add command to load data from gamertag
            new Console.Command('config', [
                new Console.Command('init', [
                    new Console.Command('member', this.initMemberAction.bind(this)),
                    //new Console.Command('characters', this.initCharacterAction.bind(this)),
                ]),
                new Console.Command('set', this.setAction.bind(this)),
            ]),
            new Console.Command('list', this.listAction.bind(this)),
            new Console.Command('parse', this.testFilterAction.bind(this)),
            new Console.Command('mark', this.markAction.bind(this)),
            new Console.Command('umark', this.unmarkAction.bind(this)),
            new Console.Command('unmark', this.unmarkAction.bind(this)),
            new Console.Command('move-marks', this.transferAction.bind(this)),
            new Console.Command('reset', this.resetAction.bind(this))
        ]);

        this.consoleOptions.header = [
            '---------------------------------------------',
            'Destiny character management console v' + package.version
        ];

        this.inventoryManager = new InventoryManager.InventoryManager();
        this.transferMan = new InventoryItemTransferManager(this.inventoryManager);
    }

    public start() {
        console.log('Loading inventory data... this could take a few seconds');
        this.inventoryManager.loadState().then(() => {
            console.log('Inventory data loaded.');
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
        }
    }

    private listAction(fullArgs: string, characterAlias: string, filterStr: string) {
        var filter = new Filters.InventoryFilter(filterStr);
        var items = this.getItemsFromAlias(characterAlias);

        if (items == null) {
            console.log('Invalid source alias: ' + characterAlias);
            return;
        }

        var filteredItems = filter.findMatchesInCollection(items);
        this.printItemTable(filteredItems);
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

        this.transferMan.transferDesignatedItems(targetCharacter);
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

    private resetAction(fullArgs: string, target: string) {
        switch (target) {
            case 'marks':
                Configuration.currentConfig.designatedItems.splice(0);
                break;
            case 'cookie':
                Configuration.currentConfig.authCookie = undefined;
                break;
            default:
                console.error('Unknown reset target: ' + target);
                break;
        }

        Configuration.currentConfig.save();
    }

    private initMemberAction(fullArgs: string, network: string, userName: string): Promise<any> {
        var parsedNetwork = ParserUtils.parseMemberNetworkType(network);

        return Configuration.currentConfig.loadMemberInfoFromApi(userName, parsedNetwork);
    }

    private printItemTable(items: Inventory.InventoryItem[]) {
        var resultTable = new Table();

        for (var i in items) {
            var chalkChain = [];

            var itemBucket = items[i].bucket;
            if (ParserUtils.isVault(itemBucket))
                itemBucket = ParserUtils.getGearBucketForVaultItem(items[i]);

            switch (itemBucket) {
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

            resultTable.cell('', chalkify('█') + (items[i].getIsEquipped() == true ? '>' : ''));
            resultTable.cell('Name', items[i].name);
            resultTable.cell('Tier', Inventory.InventoryItemTier[items[i].tier]);
            resultTable.cell('Type', Inventory.InventoryItemType[items[i].type]);
            // TODO: designated
            resultTable.newRow();
        }

        console.log(resultTable.toString());
    }

    public getItemsFromAlias(sourceAlias: string): Inventory.InventoryItem[] {
        if (sourceAlias.toLowerCase() === 'vault') {
            return this.inventoryManager.getAllVaultItems();
        }
        else if (sourceAlias.toLowerCase() === 'marks') {
            return Configuration.currentConfig.designatedItems;
        }

        var targetCharacter = Configuration.currentConfig.getCharacterFromAlias(sourceAlias);

        if (targetCharacter == null)
            return null;

        return this.inventoryManager.getAllCharacterItems(targetCharacter)
    }
}