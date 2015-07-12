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
}

export enum CharacterClass {
    Titan,
    Hunter,
    Warlock
}