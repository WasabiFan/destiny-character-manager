export class Character {
    public class: CharacterClass;
    public id: string;
}

export class AliasedCharacter extends Character {
    public alias: string;
}

export enum CharacterClass {
    Titan,
    Hunter,
    Warlock
}