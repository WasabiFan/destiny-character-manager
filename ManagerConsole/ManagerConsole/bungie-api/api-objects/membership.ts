var destiny = require('destiny-client');

export class Member {
    public id: string;
    public type: MemberType;

    constructor(id: string, type: MemberType) {
        this.id = id;
        this.type = type;
    }

    public static loadFromPlain(plainObj: any): Member {
        return new Member(plainObj.id, plainObj.type);
    }
}

export enum MemberType {
    XboxLive = 1,
    PlayStationNetwork = 2
}