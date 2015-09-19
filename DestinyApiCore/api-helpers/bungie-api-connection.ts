import Membership = require('../bungie-api/api-objects/membership');
import Characters = require('../bungie-api/api-objects/character');
import ApiCoreUtils = require('../bungie-api/api-core-utils');
import Caches = require('./caches');

export class BungieApiConnection {
    private _authCsrf: string;
    private _authCookie: string;
    private _authApiKey: string;

    private _debugMode: boolean;

    private _authMember: Membership.Member;
    private _characters: Characters.Character[];

    constructor(authMember: Membership.Member, apiKey: string, authCsrf?: string, authCookie?: string) {
        this.authApiKey = apiKey;
        this.authCsrf = authCsrf;
        this.authCookie = authCookie;

        this.authMember = authMember;
    }

    public get authCsrf(): string {
        return this._authCsrf;
    }

    public set authCsrf(value: string) {
        this._authCsrf = value;
    }

    public get authCookie(): string {
        return this._authCookie;
    }

    public set authCookie(value: string) {
        this._authCookie = value;
    }

    public get authApiKey() {
        return this._authApiKey;
    }

    public set authApiKey(value: string) {
        this._authApiKey = value;
    }

    public get authMember(): Membership.Member {
        return this._authMember;
    }

    public set authMember(value: Membership.Member) {
        this._authMember = value;
    }

    public get characters(): Characters.Character[]{
        return this._characters;
    }

    public get debugMode(): boolean {
        return this._debugMode;
    }

    public set debugMode(value: boolean) {
        this._debugMode = value;
    }

    public get authHeaders(): any {
        return {
            'Cookie': this.authCookie,
            'x-api-key': this.authApiKey,
            'x-csrf': this.authCsrf
        };
    }
}