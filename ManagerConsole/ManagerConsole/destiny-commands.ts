import _ = require('underscore');

import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import Inventory = require('./bungie-api/api-objects/inventory');
import Character = require('./bungie-api/api-objects/character');
import Configuration = require('./config-manager');
import Console = require('./command-console');
import GearCollection = require('./bungie-api/api-objects/bucket-gear-collection');
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

    private glimmerMap: { [itemHash: string]: number } = {
        // Axiomatic Beads
        '2904517731': 200,
        // House Banners
        '269776572': 200,
        // Network Keys
        '1932910919': 200,
        // Silken Codex
        '3632619276': 200,
        // Royal Amethyst (large version)
        '51034763': 5000,
        // Royal Amethyst (small version)
        '1428782718': 2500
    }

    constructor() {
        this.consoleOptions = new Console.CommandConsoleOptions();
        this.consoleOptions.commandRoot = new Console.Command(null, [
            // TODO: Add command to load data from gamertag
            new Console.Command('config', [
                new Console.Command('init', [
                    new Console.Command('member', this.initMemberAction.bind(this)),
                    new Console.Command('characters', this.initCharacterAction.bind(this)),
                ]),
                new Console.Command('set', this.setAction.bind(this)),
                new Console.Command('reload', this.reloadConfigAction.bind(this)),
                new Console.Command('save', this.saveConfigAction.bind(this))
            ]),
            new Console.Command('list', this.listAction.bind(this)),
            new Console.Command('parse', this.testFilterAction.bind(this)),
            new Console.Command('mark', this.markAction.bind(this)),
            new Console.Command('umark', this.unmarkAction.bind(this)),
            new Console.Command('unmark', this.unmarkAction.bind(this)),
            new Console.Command('move-marks', this.transferAction.bind(this)),
            new Console.Command('reset', this.resetAction.bind(this)),
            new Console.Command('calc-glimmer', this.calcGlimmerAction.bind(this))

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
        }).catch(error => {
            console.log('Error encountered while loading data. Please restart the app and try again.');

            // TODO: Tab in multiple lines (split and join)
            console.log('    ' + error);
        });
    }

    private setAction(fullArgs: string, propName: string, propValue: string) {
        propName = propName.toLowerCase();
        var wholeVal = fullArgs.substring(fullArgs.indexOf(' ') + 1);
        
        switch (propName) {
            case 'cookie':
                Configuration.currentConfig.authCookie = wholeVal;
                break;
            case 'debug':
                Configuration.currentConfig.debugMode = propValue == 'true';
                break;
        }

        Configuration.currentConfig.save();
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
        this.reportDesignationValidity();

        Configuration.currentConfig.save();
    }

    private unmarkAction(fullArgs: string, filterStr: string) {
        var filter = new Filters.InventoryFilter(filterStr);
        this.inventoryManager.applyFilterToDesignatedItems(undefined, filter, Filters.FilterMode.Remove);
        this.reportDesignationValidity();

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

    private initMemberAction(fullArgs: string, network: string, ...userName: string[]): Promise<any> {
        var parsedNetwork = ParserUtils.parseMemberNetworkType(network);

        return Configuration.currentConfig.loadMemberInfoFromApi(userName.join(' '), parsedNetwork);
    }

    private initCharacterAction(fullArgs: string): Promise<any> {
        if (Configuration.currentConfig.authMember == undefined) {
            var errorStr = 'You must load basic authentication info before querying for characters.';
            return Promise.reject(new Error(errorStr));
        }

        return Configuration.currentConfig.loadDefaultCharactersFromApi();
    }

    private reloadConfigAction(fullArgs: string) {
        Configuration.loadCurrentConfig();
    }

    private saveConfigAction(fullArgs: string) {
        Configuration.currentConfig.save();
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

    public getItemsFromAlias(sourceAlias: string): Inventory.InventoryItem[]{
        if (sourceAlias == null || sourceAlias == undefined)
            return null;

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

    public reportDesignationValidity() {
        var buckets = new GearCollection.BucketGearCollection(Configuration.currentConfig.designatedItems);
        var errorMessages = [];

        ParserUtils.exoticBucketGroups.forEach((bucketGroup, index) => {
            var onlyExotics = _.select(bucketGroup, bucket => {
                var items = buckets.getItems(bucket);
                return items.length > 0 && _.every(items, item => item.tier === Inventory.InventoryItemTier.Exotic);
            });

            if (onlyExotics.length > 1)
                // TODO: Report specific buckets
                errorMessages.push('Multiple designated buckets contain only exotic items. There may be unexpected items equipped in these slots if you start a transfer.');
        });

        if (errorMessages.length > 0) {
            console.warn('Your current configuration isn\'t valid!');
            errorMessages.forEach(message => console.warn('    ' + message));
        }
    }

    private calcGlimmerAction(fillArgs: string, characterAlias: string) {
        var items = this.getItemsFromAlias(characterAlias);

        if (items == null) {
            console.log('Invalid source alias: ' + characterAlias);
            return;
        }

        var table = new Table();
        
        var total = 0;
        for (var i in items) {
            if (this.glimmerMap[items[i].itemHash] == undefined)
                continue;

            var totalWorth = this.glimmerMap[items[i].itemHash] * items[i].getStackSize();

            table.cell('Item name', items[i].name);
            table.cell('Item stack size', items[i].getStackSize());
            table.cell('Individual worth', this.glimmerMap[items[i].itemHash]);
            table.cell('Total', totalWorth);
            table.newRow();

            total += totalWorth;
        }

        table.total('Total', undefined, undefined);
        console.log(table.toString());
    }
}