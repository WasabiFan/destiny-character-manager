import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import Inventory = require('./bungie-api/api-objects/inventory');
import Character = require('./bungie-api/api-objects/character');
import Configuration = require('./config-manager');
import Console = require('./command-console');
import ManagementQueue = require('./inventory-management-queue');
import InventoryItemTransferManager = require('./inventory-item-transfer-manager');
import Filters = require('./filters');
import Table = require('easy-table');
import Chalk = require('chalk');

export class DestinyCommandConsole {
    private bucketFilterStrs = {
        'primary': Inventory.InventoryBucket.PrimaryWeapon,
        'pri': Inventory.InventoryBucket.PrimaryWeapon,
        'p': Inventory.InventoryBucket.PrimaryWeapon,
        'special': Inventory.InventoryBucket.SpecialWeapon,
        'spec': Inventory.InventoryBucket.SpecialWeapon,
        's': Inventory.InventoryBucket.SpecialWeapon,
        'secondary': Inventory.InventoryBucket.SpecialWeapon,
        'heavy': Inventory.InventoryBucket.HeavyWeapon,
        'h': Inventory.InventoryBucket.HeavyWeapon,
    };

    private tierFilterStrs = {
        'common': Inventory.InventoryItemTier.Common,
        'c': Inventory.InventoryItemTier.Common,
        'uncommon': Inventory.InventoryItemTier.Uncommon,
        'unc': Inventory.InventoryItemTier.Uncommon,
        'u': Inventory.InventoryItemTier.Uncommon,
        'rare': Inventory.InventoryItemTier.Rare,
        'r': Inventory.InventoryItemTier.Rare,
        'legendary': Inventory.InventoryItemTier.Legendary,
        'l': Inventory.InventoryItemTier.Legendary,
        'exotic': Inventory.InventoryItemTier.Exotic,
        'ex': Inventory.InventoryItemTier.Exotic,
        'e': Inventory.InventoryItemTier.Exotic,
    };

    private quantifierFilterStrs = {
        '+': Filters.FilterQuantifier.AndHigher,
        '-': Filters.FilterQuantifier.AndLower
    }

    private console: Console.CommandConsole;
    private consoleOptions: Console.CommandConsoleOptions;
    private inventoryManager: ManagementQueue.InventoryManagementQueue;

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
        this.inventoryManager = new ManagementQueue.InventoryManagementQueue();
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
        var targetCharacter = this.getCharacterFromAlias(characterAlias);

        if (targetCharacter == null) {
            console.log('Invalid character alias: ' + characterAlias);
            return;
        }

        var filteredItems = this.findAllFilterMatches(this.getAllCharacterItems(targetCharacter), this.parseFilterStr(filterStr));

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

    private applyDesignatedItemsFilter(characterAlias: string, filterStr: string, filterMode: Filters.FilterMode) {
        var targetCharacter = this.getCharacterFromAlias(characterAlias);

        // If they're removing items, they don't need to specify a character
        if (targetCharacter == null && filterMode == Filters.FilterMode.Add) {
            console.log('Invalid character alias: ' + characterAlias);
            return;
        }

        var filterObj = this.parseFilterStr(filterStr);

        var collectionToSearch: Inventory.InventoryItem[] = [];
        if (filterMode == Filters.FilterMode.Add) {
            collectionToSearch = this.getAllCharacterItems(targetCharacter);
        }
        else if (filterMode == Filters.FilterMode.Remove) {
            collectionToSearch = Configuration.currentConfig.designatedItems
        }

        var selectedItems = this.findAllFilterMatches(collectionToSearch, filterObj);

        if (filterMode == Filters.FilterMode.Add) {
            Configuration.currentConfig.designatedItems.push.apply(Configuration.currentConfig.designatedItems, selectedItems);
        }
        else if (filterMode == Filters.FilterMode.Remove) {
            for (var selIndex in selectedItems) {
                var designatedItemIndex = this.customIndexOf(Configuration.currentConfig.designatedItems,(item) => {
                    return item.instanceId == selectedItems[selIndex].instanceId
                        && item.itemHash == selectedItems[selIndex].itemHash;
                });

                Configuration.currentConfig.designatedItems.splice(designatedItemIndex, 1);
            }
        }
    }

    private getAllCharacterItems(targetCharacter: Character.Character): Inventory.InventoryItem[] {
        var result: Inventory.InventoryItem[] = [];

        var inventoryState = this.inventoryManager.getCurrentState();
        var inventoryBuckets = inventoryState.characters[targetCharacter.id].buckets;
        for (var bucketIndex in inventoryBuckets) {
            result.push.apply(result, inventoryBuckets[bucketIndex].contents);
        }

        return result;
    }

    private findAllFilterMatches(itemCollection: Inventory.InventoryItem[], filterObj: Filters.FilterCriteria): Inventory.InventoryItem[] {
        var result: Inventory.InventoryItem[] = [];
        for (var i in itemCollection) {
            if (filterObj.doesMeetCriteria(itemCollection[i]))
                result.push(itemCollection[i]);
        }

        return result;
    }

    private customIndexOf(collection: any[], selector: (item: any) => boolean): number {
        var targetIndex: number = -1;
        for (var i in collection)
            if (selector(collection[i]))
                targetIndex = i;

        return targetIndex;
    }

    private parseFilterStr(filterStr: string): Filters.FilterCriteria {
        var filterObj = new Filters.FilterCriteria();

        if (filterStr == undefined || filterStr.length <= 0)
            return filterObj;

        // TODO: support excludes
        // TODO: support quantifiers for bucket?
        var filterParts = filterStr.split(';');
        for (var i in filterParts) {
            var filterDesc = this.loadFilterPartInfo(filterParts[i]);

            switch (filterDesc.filterType) {
                case Filters.FilterType.Invalid:
                    console.error('Invalid filter: ' + filterParts[i]);
                    break;
                case Filters.FilterType.NameFilter:
                    // TODO
                    break;
                case Filters.FilterType.BucketFilter:
                    filterObj.buckets.push(filterDesc.baseBucket);
                    break;
                case Filters.FilterType.TierFilter:
                    var newTiers = this.getTiersForQuantifier(filterDesc.baseTier, filterDesc.quantifier);
                    filterObj.tiers.push.apply(filterObj.tiers, newTiers);
                    break;
            }
        }

        return filterObj;
    }

    private loadFilterPartInfo(filterPart: string): Filters.FilterDescriptor {
        var filterDesc: Filters.FilterDescriptor = new Filters.FilterDescriptor();

        if (filterPart.indexOf('~') === 0) {
            filterDesc.filterType = Filters.FilterType.NameFilter;
            // TODO: parse name part
            return filterDesc;
        }

        var wordPartMatches = filterPart.match(/^\w+/);

        if (wordPartMatches == undefined) {
            filterDesc.filterType = Filters.FilterType.Invalid;
            return filterDesc
        }

        var wordPart = wordPartMatches[0];

        var tierFilter = this.tierFilterStrs[wordPart];
        var bucketFilter = this.bucketFilterStrs[wordPart];
        var quantifierAddition = this.quantifierFilterStrs[filterPart.substring(wordPart.length)];

        if (tierFilter != undefined) {
            filterDesc.filterType = Filters.FilterType.TierFilter;
            filterDesc.baseTier = tierFilter;
            filterDesc.quantifier = quantifierAddition;
        }
        else if (bucketFilter != undefined) {
            filterDesc.filterType = Filters.FilterType.BucketFilter;
            filterDesc.baseBucket = bucketFilter;
        }

        return filterDesc;
    }

    private getTiersForQuantifier(baseTier: Inventory.InventoryItemTier, quantifier: Filters.FilterQuantifier): Inventory.InventoryItemTier[] {
        if (quantifier == undefined)
            return [baseTier];

        var result: Inventory.InventoryItemTier[] = [];
        for (var tier: number = baseTier; tier >= 0 && Inventory.InventoryItemTier[tier] != undefined; tier += quantifier)
            result.push(tier);

        return result;
    }

    private testFilterAction(fullArgs: string) {
        var filterObj = this.parseFilterStr(fullArgs);

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
        var targetCharacter = this.getCharacterFromAlias(characterAlias);
        if (targetCharacter == null) {
            console.log('Invalid character alias: ' + characterAlias);
            return;
        }

        InventoryItemTransferManager.transferDesignatedItems(targetCharacter);
    }

    private getCharacterFromAlias(alias: string): Character.AliasedCharacter {
        if (alias == null || alias == undefined)
            return null;

        var targetCharacter = null;
        for (var i in Configuration.currentConfig.characters) {
            if (Configuration.currentConfig.characters[i].alias.toLowerCase() == alias.toLowerCase())
                targetCharacter = Configuration.currentConfig.characters[i];
        }

        return targetCharacter;
    }

    private markAction(fullArgs: string, characterAlias: string, filterStr: string) {
        this.applyDesignatedItemsFilter(characterAlias, filterStr, Filters.FilterMode.Add);
        Configuration.currentConfig.save();
    }

    private unmarkAction(fullArgs: string, filterStr: string) {
        this.applyDesignatedItemsFilter(undefined, filterStr, Filters.FilterMode.Remove);
        Configuration.currentConfig.save();
    }
}