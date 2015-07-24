import fs = require('fs');
import _ = require('underscore');
var Resurrect = require('../Scripts/resurrect');

export class LocalDataStore<ConfigType> {
    public currentData: ConfigType;
    private filePath: string;
    private necromancer;

    private configType: {
        new (): ConfigType
    };

    constructor(filePath: string, configType: { new (): ConfigType }, ...necessarySubtypes: { new (...any): any }[]) {
        this.filePath = filePath;
        this.configType = configType;

        // Probably should create a new array here
        necessarySubtypes.push(configType);

        var necroContext = {};
        for (var i in necessarySubtypes)
            necroContext[(<any>necessarySubtypes[i]).name] = necessarySubtypes[i];

        this.necromancer = new Resurrect({
            resolver: new Resurrect.NamespaceResolver(necroContext)
        });
    }

    public load() {
        if (fs.existsSync(this.filePath)) {
            var dataStr = fs.readFileSync(this.filePath).toString();
            this.currentData = this.necromancer.resurrect(dataStr);
        }
        else
            this.currentData = new this.configType();
    }

    public save() {
        var jsonObj = JSON.parse(this.necromancer.stringify(this.currentData));
        fs.writeFileSync(this.filePath, JSON.stringify(jsonObj, null, 4));
    }
}