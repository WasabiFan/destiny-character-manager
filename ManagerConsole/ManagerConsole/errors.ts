
export declare class Error {
    public name: string;
    public message: string;
    public stack: string;
    constructor(message?: string);
}

export class Exception extends Error {
    public innerData: Exception | Error;

    constructor(message: string, innerData?: Exception | Error) {
        super(message);
        this.name = 'Exception';
        this.message = message;
        this.stack = (<any>new Error()).stack;

        this.innerData = innerData;
    }

    public toString() {
        return this.name + ': ' + this.message;
    }
}