import _ = require('underscore');
var package = require('../package.json');
import chalk = require('chalk');
import Table = require('easy-table');

// Bungie API
import Inventory = require('../bungie-api/api-objects/inventory');
import Character = require('../bungie-api/api-objects/character');
import Membership = require('../bungie-api/api-objects/membership');
import GearCollection = require('../bungie-api/api-objects/bucket-gear-collection');
import Bungie = require('../bungie-api/api-core');
import Vault = require('../bungie-api/vault-api');
import Gear = require('../bungie-api/gear-api');
import ParserUtils = require('../bungie-api/parser-utils');

// Utils
import DataStores = require('../utils/data-stores');
import Console = require('../utils/command-console');
import Errors = require('../utils/errors');

// API helpers
import InventoryTransferManager = require('../api-helpers/inventory-transfer-manager');
import InventoryManager = require('../api-helpers/inventory-manager');

// App core
import Filters = require('../app-core/filters');

export class DestinyCommandConsole {
    private commandConsole: Console.CommandConsole;
    private consoleOptions: Console.CommandConsoleOptions;
    private inventoryManager: InventoryManager.InventoryManager;
    private transferMan: InventoryTransferManager;

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
            new Console.Command('calc-glimmer', this.calcGlimmerAction.bind(this)),
            new Console.Command('update-state', this.updateStateAction.bind(this)),

        ]);

        this.consoleOptions.header = [
            '---------------------------------------------',
            'Destiny character management console v' + package.version
        ];

        this.consoleOptions.warningExceptionCodes.push(Errors.ExceptionCode.InsufficientAuthConfig);

        this.inventoryManager = new InventoryManager.InventoryManager();
        this.transferMan = new InventoryTransferManager(this.inventoryManager);
    }

    public start() {
        this.reloadState().then(() => {
            this.commandConsole = new Console.CommandConsole(this.consoleOptions);
            this.commandConsole.start();

        }).catch((error: Errors.Exception) => {
            console.log('Error encountered while loading data. Please restart the app and try again.');

            // TODO: Figure out what we want to print here
            console.log('  ' + error.toString());
            console.log('  ' + error.stack);
        });
    }

    private assertFullAuth() {
        if (!DataStores.DataStores.appConfig.currentData.hasFullAuthInfo)
            throw new Errors.Exception('You cannot perform this action without loaded authentication info.', Errors.ExceptionCode.InsufficientAuthConfig);
    }

    private reloadState(): Promise<any> {
        var promise = new Promise((resolve, reject) => {
            console.log('Loading inventory data... this could take a few seconds');
            this.inventoryManager.loadState().then(() => {
                console.log('Inventory data loaded.');
                resolve();
            }).catch((error: Errors.Exception) => {
                if (error.exceptionCode == Errors.ExceptionCode.InsufficientAuthConfig) {
                    console.warn(chalk.bgYellow(error.message));
                    console.warn('You may still use the console, but only configuration commands will be available.');
                    // TODO: add note about reloading state when configured w/ instructions on configuring

                    resolve();
                }
                else
                    reject(error);
            });
        });

        return promise;
    }

    private setAction(fullArgs: string, propName: string, propValue: string) {
        // TODO: Use separate commands for each target instead
        propName = propName.toLowerCase();
        var wholeVal = fullArgs.substring(fullArgs.indexOf(' ') + 1);
        
        switch (propName) {
            case 'cookie':
                DataStores.DataStores.appConfig.currentData.authCookie = wholeVal;
                break;
            case 'apikey':
            case 'key':
                DataStores.DataStores.appConfig.currentData.apiKey = wholeVal;
                break;
            case 'csrf':
                DataStores.DataStores.appConfig.currentData.csrf = wholeVal;
                break;
            case 'debug':
                DataStores.DataStores.appConfig.currentData.debugMode = propValue == 'true';
                break;
        }

        DataStores.DataStores.appConfig.save();
    }

    private listAction(fullArgs: string, characterAlias: string, filterStr: string) {
        this.assertFullAuth();

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

    private transferAction(fullArgs: string, characterAlias: string): Promise<any> {
        this.assertFullAuth();

        var targetCharacter = DataStores.DataStores.appConfig.currentData.getCharacterFromAlias(characterAlias);
        if (targetCharacter == null) {
            console.log('Invalid character alias: ' + characterAlias);
            return;
        }

        return this.transferMan.transferDesignatedItems(targetCharacter);
    }

    private markAction(fullArgs: string, characterAlias: string, filterStr: string) {
        this.assertFullAuth();

        var filter = new Filters.InventoryFilter(filterStr);
        this.inventoryManager.applyFilterToDesignatedItems(characterAlias, filter, Filters.FilterMode.Add);
        this.reportDesignationValidity();

        DataStores.DataStores.appConfig.save();
    }

    private unmarkAction(fullArgs: string, filterStr: string) {
        this.assertFullAuth();

        var filter = new Filters.InventoryFilter(filterStr);
        this.inventoryManager.applyFilterToDesignatedItems(undefined, filter, Filters.FilterMode.Remove);
        this.reportDesignationValidity();

        DataStores.DataStores.appConfig.save();
    }

    private resetAction(fullArgs: string, target: string) {
        switch (target) {
            case 'marks':
                DataStores.DataStores.appConfig.currentData.designatedItems.splice(0);
                break;
            case 'cookie':
                DataStores.DataStores.appConfig.currentData.authCookie = undefined;
                break;
            default:
                console.error('Unknown reset target: ' + target);
                break;
        }

        DataStores.DataStores.appConfig.save();
    }

    private initMemberAction(fullArgs: string, network: string, ...userName: string[]): Promise<any> {
        var parsedNetwork = ParserUtils.parseMemberNetworkType(network);

        if (_.isNull(parsedNetwork))
            return Promise.reject(new Errors.Exception('You must pass a valid network identidier as the first parameter to this init command. Try "xbl" or "psn".', Errors.ExceptionCode.InvalidCommandParams));

        return DataStores.DataStores.appConfig.currentData
            .loadMemberInfoFromApi(userName.join(' '), parsedNetwork)
            .then(() => DataStores.DataStores.appConfig.save());
    }

    private initCharacterAction(fullArgs: string): Promise<any> {
        if (DataStores.DataStores.appConfig.currentData.authMember == undefined) {
            var errorStr = 'You must load basic authentication info before querying for characters.';
            return Promise.reject(new Errors.Exception(errorStr));
        }

        return DataStores.DataStores.appConfig.currentData
            .loadDefaultCharactersFromApi()
            .then(() => DataStores.DataStores.appConfig.save());
    }

    private reloadConfigAction(fullArgs: string) {
        DataStores.DataStores.appConfig.load();
    }

    private saveConfigAction(fullArgs: string) {
        DataStores.DataStores.appConfig.save();
    }

    private printItemTable(items: Inventory.InventoryItem[]) {
        var resultTable = new Table();

        for (var i in items) {
            var chalkifyBucket = chalk.gray, chalkifyTier = chalk.white;

            var itemBucket = items[i].bucket;
            if (ParserUtils.isVault(itemBucket))
                itemBucket = ParserUtils.getGearBucketForVaultItem(items[i]);

            switch (itemBucket) {
                case Inventory.InventoryBucket.PrimaryWeapon:
                    chalkifyBucket = chalk.white;
                    break;
                case Inventory.InventoryBucket.SpecialWeapon:
                    chalkifyBucket = chalk.green;
                    break;
                case Inventory.InventoryBucket.HeavyWeapon:
                    chalkifyBucket = chalk.magenta;
                    break;
                case Inventory.InventoryBucket.Helmet:
                    chalkifyBucket = chalk.cyan;
                    break;
                case Inventory.InventoryBucket.Gauntlets:
                    chalkifyBucket = chalk.blue;
                    break;
                case Inventory.InventoryBucket.ChestArmor:
                    chalkifyBucket = chalk.yellow;
                    break;
                case Inventory.InventoryBucket.LegArmor:
                    chalkifyBucket = chalk.red;
                    break;
            }

            switch (items[i].tier) {
                case Inventory.InventoryItemTier.Uncommon:
                    chalkifyTier = chalk.green;
                    break;
                case Inventory.InventoryItemTier.Rare:
                    chalkifyTier = chalk.blue;
                    break;
                case Inventory.InventoryItemTier.Legendary:
                    chalkifyTier = chalk.magenta;
                    break;
                case Inventory.InventoryItemTier.Exotic:
                    chalkifyTier = chalk.yellow;
                    break;
            }

            var stackSize = items[i].getStackSize();

            resultTable.cell('', chalkifyBucket('█') + (items[i].getIsEquipped() == true ? '>' : ''));
            resultTable.cell('Name', items[i].name);
            resultTable.cell('Tier', chalkifyTier(Inventory.InventoryItemTier[items[i].tier]));
            resultTable.cell('Type', Inventory.InventoryItemType[items[i].type]);
            resultTable.cell('Stack size', stackSize == 1 ? '' : stackSize);
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
            return DataStores.DataStores.appConfig.currentData.designatedItems;
        }

        var targetCharacter = DataStores.DataStores.appConfig.currentData.getCharacterFromAlias(sourceAlias);

        if (targetCharacter == null)
            return null;

        return this.inventoryManager.getAllCharacterItems(targetCharacter)
    }

    public reportDesignationValidity() {
        var buckets = new GearCollection.BucketGearCollection(DataStores.DataStores.appConfig.currentData.designatedItems);
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

    private calcGlimmerAction(fullArgs: string, characterAlias: string) {
        this.assertFullAuth();

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

    private updateStateAction(fullAction: string): Promise<any> {
        return this.reloadState();
    }
}