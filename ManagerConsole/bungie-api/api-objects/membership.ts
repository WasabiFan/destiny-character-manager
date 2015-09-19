
export class Member {
    public id: string;
    public type: MemberNetworkType;

    constructor(id: string, type: MemberNetworkType) {
        this.id = id;
        this.type = type;
    }

    public static loadFromPlain(plainObj: any): Member {
        return new Member(plainObj.id, plainObj.type);
    }

    public static loadFromApiResponse(apiObj: any): Member {
        return new Member(apiObj.membershipId, apiObj.membershipType);
    }
}

export enum MemberNetworkType {
    XboxLive = 1,
    PlayStationNetwork = 2
}