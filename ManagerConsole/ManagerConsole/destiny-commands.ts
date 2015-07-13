import Vault = require('./bungie-api/vault-api');
import Gear = require('./bungie-api/gear-api');
import Inventory = require('./bungie-api/api-objects/inventory');
import Character = require('./bungie-api/api-objects/character');
import Configuration = require('./config-manager');
import Console = require('./command-console');
import ManagementQueue = require('./inventory-management-queue');
import InventoryItemTransferManager = require('./inventory-item-transfer-manager');

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
        '+': FilterQuantifier.AndHigher,
        '-': FilterQuantifier.AndLower
    }

    private console: Console.CommandConsole;
    private consoleOptions: Console.CommandConsoleOptions;
    private inventoryManager: ManagementQueue.InventoryManagementQueue;

    constructor() {
        this.consoleOptions = new Console.CommandConsoleOptions();
        this.consoleOptions.commandRoot = new Console.Command(null, [
            new Console.Command('set', this.setAction.bind(this)),
            new Console.Command('list', this.listAction.bind(this)),
            new Console.Command('la', this.listAction.bind(this)),
            new Console.Command('parse', this.testFilterAction.bind(this)),
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

    private listAction(fullArgs: string) {
    }

    private filterItems(filterStr: string, baseFilter: (item: Inventory.InventoryItem) => boolean) {
        var filterObj = this.parseFilterStr(filterStr);

        //TODO: Figure out what pool of items we want to look in
    }

    private parseFilterStr(filterStr: string): FilterData {
        var filterObj = new FilterData();

        // TODO: support excludes
        // TODO: support quantifiers for bucket?
        var filterParts = filterStr.split(' ');
        for (var i in filterParts) {
            var filterDesc = this.loadFilterPartInfo(filterParts[i]);

            switch (filterDesc.filterType) {
                case FilterType.Invalid:
                    console.error('Invalid filter: ' + filterParts[i]);
                    break;
                case FilterType.NameFilter:
                    // TODO
                    break;
                case FilterType.BucketFilter:
                    filterObj.buckets.push(filterDesc.baseBucket);
                    break;
                case FilterType.TierFilter:
                    var newTiers = this.getTiersForQuantifier(filterDesc.baseTier, filterDesc.quantifier);
                    filterObj.tiers.push.apply(filterObj.tiers, newTiers);
                    break;
            }
        }

        return filterObj;
    }

    private loadFilterPartInfo(filterPart: string): FilterDescriptor {
        var filterDesc: FilterDescriptor = new FilterDescriptor();

        if (filterPart.indexOf('~') === 0) {
            filterDesc.filterType = FilterType.NameFilter;
            // TODO: parse name part
            return filterDesc;
        }

        var wordPartMatches = filterPart.match(/^\w+/);

        if (wordPartMatches == undefined) {
            filterDesc.filterType = FilterType.Invalid;
            return filterDesc
        }

        var wordPart = wordPartMatches[0];

        var tierFilter = this.tierFilterStrs[wordPart];
        var bucketFilter = this.bucketFilterStrs[wordPart];
        var quantifierAddition = this.quantifierFilterStrs[filterPart.substring(wordPart.length)];

        if (tierFilter != undefined) {
            filterDesc.filterType = FilterType.TierFilter;
            filterDesc.baseTier = tierFilter;
            filterDesc.quantifier = quantifierAddition;
        }
        else if (bucketFilter != undefined) {
            filterDesc.filterType = FilterType.BucketFilter;
            filterDesc.baseBucket = bucketFilter;
        }

        return filterDesc;
    }

    private getTiersForQuantifier(baseTier: Inventory.InventoryItemTier, quantifier: FilterQuantifier): Inventory.InventoryItemTier[] {
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
        if (characterAlias == undefined) {
            console.log('Error: You must specify a character to transfer items to.');
            return;
        }

        var targetCharacter = null;
        for (var i in Configuration.currentConfig.characters) {
            if (Configuration.currentConfig.characters[i].alias.toLowerCase() == characterAlias.toLowerCase())
                targetCharacter = Configuration.currentConfig.characters[i];
        }

        if (targetCharacter == null) {
            console.log('Invalid character alias: ' + characterAlias);
            return;
        }

        InventoryItemTransferManager.transferDesignatedItems(targetCharacter);
    }
}

export enum FilterQuantifier {
    AndHigher = 1,
    AndLower = -1
}

export class FilterDescriptor {
    public baseTier: Inventory.InventoryItemTier;
    public baseBucket: Inventory.InventoryBucket;
    public quantifier: FilterQuantifier;
    public filterType: FilterType;
}

export class FilterData {
    public tiers: Inventory.InventoryItemTier[] = [];
    public buckets: Inventory.InventoryBucket[] = [];
}

export enum FilterType {
    TierFilter,
    BucketFilter,
    NameFilter,
    Invalid = -1
}