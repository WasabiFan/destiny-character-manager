import fs = require('fs');
import _ = require('underscore');
var Resurrect = require('../../Scripts/resurrect');
import Armory = require('../bungie-api/armory-api-loader');

export interface ObjectCache<DataType> {
    reload();
    save();

    currentData: DataType;
}

export class FileObjectCache<DataType> implements ObjectCache<DataType> {
    private _currentData: DataType;
    private filePath: string;
    private necromancer;

    private dataType: new (saveData: () => void) => DataType;

    constructor(filePath: string, dataType: new (saveData: () => void) => DataType, ...extraSubtypes: { new (...any): any }[]) {
        this.filePath = filePath;
        this.dataType = dataType;

        var allSubtypes = extraSubtypes.concat([dataType]);

        var necroContext = {};
        for (var i in allSubtypes)
            necroContext[(<any>allSubtypes[i]).name] = allSubtypes[i];

        this.necromancer = new Resurrect({
            resolver: new Resurrect.NamespaceResolver(necroContext)
        });
    }

    public reload() {
        if (fs.existsSync(this.filePath)) {
            var dataStr = fs.readFileSync(this.filePath).toString();
            this._currentData = this.necromancer.resurrect(dataStr);
        }
        else
            this._currentData = new this.dataType(this.save);
    }

    public save() {
        // TODO: This is a really dangerous hack but I don't know what's wrong
        var jsonObj = JSON.parse(this.necromancer.stringify(this.currentData));
        fs.writeFileSync(this.filePath, JSON.stringify(jsonObj, null, 4));
    }

    public get currentData(): DataType {
        return this._currentData;
    }
}

export class BungieApiCacheData {
    public itemMetadata: { [itemHash: string]: Armory.ItemArmoryMetadata } = {};
    private saveState: () => any;

    public BungieApiCacheData(saveState: () => any) {
        this.itemMetadata = {};
        this.saveState = saveState;
    }

    public getOrLoadItemMetadataForHash(itemHash: string): Promise<Armory.ItemArmoryMetadata> {
        if (!_.isUndefined(this.itemMetadata[itemHash]))
            return Promise.resolve(this.itemMetadata[itemHash]);

        var metadataPromise = Armory.ArmoryApi.loadArmoryMetadataForItemHash(itemHash);
        metadataPromise.then((metadata) => {
            this.itemMetadata[itemHash] = metadata;
            this.saveState();
        });

        return metadataPromise;
    }
}