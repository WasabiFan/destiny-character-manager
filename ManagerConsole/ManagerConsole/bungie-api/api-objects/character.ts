import Membership = require('./membership');

export class Character {
    public characterClass: CharacterClass;
    public id: string;

    constructor(id: string, characterClass: CharacterClass) {
        this.characterClass = characterClass;
        this.id = id;
    }
}

export class AliasedCharacter extends Character {
    public alias: string;

    constructor(id: string, characterClass: CharacterClass, alias: string) {
        super(id, characterClass);
        this.alias = alias;
    }

    public static loadFromPlain(plainObj: any): AliasedCharacter {
        return new AliasedCharacter(plainObj.id, plainObj.characterClass, plainObj.alias);
    }

    public static loadFromApiResponse(apiObj: any): AliasedCharacter {
        var character = new AliasedCharacter(
            apiObj.characterBase.characterId,
            apiObj.characterBase.classType,
            CharacterClass[apiObj.characterBase.classType]
            );

        return character;
    }
}

export enum CharacterClass {
    Titan,
    Hunter,
    Warlock,
    Unknown = -1
}