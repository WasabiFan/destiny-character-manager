import InventoryManager = require('../api-helpers/inventory-manager');
import chalk = require('chalk');
import stackTrace = require('stack-trace');
import util = require('util');
import _ = require('underscore');

export declare class Error {
    public name: string;
    public message: string;
    public stack: string;
    constructor(message?: string);
}

export class Exception extends Error {
    public innerErrorData: Exception | Error;
    public exceptionCode: ExceptionCode;

    constructor(message: string, primaryData?: Exception | Error | ExceptionCode, secondaryData?: Exception | Error) {
        super(message);
        this.name = 'Exception';
        this.message = message;
        this.stack = (<any>new Error()).stack;

        if (_.isNumber(primaryData)) {
            this.innerErrorData = secondaryData;
            this.exceptionCode = <ExceptionCode>primaryData;
        }
        else {
            this.innerErrorData = <Exception | Error>primaryData;
            this.exceptionCode = ExceptionCode.None;
        }
    }

    public toString() {
        return this.name + ': ' + this.message;
    }

    public logErrorDetail() {
        console.error(chalk.bgRed(this.toString()));
        console.error(ErrorUtils.stringifyErrorStack(this, 1));
        if (this.innerErrorData) {
            console.error('Inner error: ');
            if (this.innerErrorData instanceof Exception)
                (<Exception>this.innerErrorData).logErrorDetail();
            else if (this.innerErrorData instanceof Error)
                console.error(ErrorUtils.stringifyErrorStack(this.innerErrorData));
            else
                // This shouldn't happen
                console.error(this.innerErrorData);
        }
    }

    public logAsWarning() {
        console.warn(chalk.bgYellow(this.message));
    }

    public logErrorMessage() {
        console.error(chalk.bgRed(this.message));
    }
}

export class InventoryQueuedOperationException extends Exception {
    public sourceOperation: InventoryManager.QueuedOperation;

    constructor(message: string, sourceOperation: InventoryManager.QueuedOperation, innerErrorData?: Exception | Error) {
        super(message, innerErrorData);
        this.name = 'InventoryQueuedOperationException';
        this.sourceOperation = sourceOperation;
    }

    public logErrorDetail() {
        super.logErrorDetail();
        console.error('Source operation:');
        console.error(this.sourceOperation.toString(1));
    }
}

export class ErrorUtils {
    private static indent = '    ';

    public static stringifyErrorStack(error: Error, numIndents?: number): string {
        var stackInfo: stackTrace.StackFrame[] = stackTrace.parse(error);
        return this.stringifyStack(stackInfo, numIndents);
    }

    public static stringifyStack(stack: stackTrace.StackFrame[], numIndents?: number): string {
        var stackStrs: string[] = [];

        // myMagicalType.myMagicalMethod (file-name.js:100)
        stack.forEach(stackItem => {
            stackStrs.push(
                util.format('%s (%s:%d)',
                    stackItem.getFunctionName(),
                    stackItem.getFileName(),
                    stackItem.getLineNumber()));
        });

        return this.increaseIndentation(stackStrs.join('\r\n'), numIndents || 0);
    }

    public static increaseIndentation(str: string, numIndents: number) {
        return str.replace(/^(?=.)/gm, new Array(numIndents + 1).join(this.indent));
    }

}

export enum ExceptionCode {
    None = 0,
    InsufficientAuthConfig,
    InvalidCommandParams
}