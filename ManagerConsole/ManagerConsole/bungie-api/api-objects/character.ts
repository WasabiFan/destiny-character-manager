export class Character {
    public class: CharacterClass;
    public id: string;
}

export class AliasedCharacter extends Character {
    public alias: string;

    public static loadFromPlain(plainObj: any): AliasedCharacter {
        var newCharacter = new AliasedCharacter();
        newCharacter.alias = plainObj.alias;
        newCharacter.id = plainObj.id;
        newCharacter.class = plainObj.class;

        return newCharacter;

    }
}

export enum CharacterClass {
    Titan,
    Hunter,
    Warlock
}