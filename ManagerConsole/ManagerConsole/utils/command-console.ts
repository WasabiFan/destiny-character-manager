var sys = require('sys');
import chalk = require('chalk');
import Errors = require('./errors');
import _ = require('underscore');

export class CommandConsole {
    private options: CommandConsoleOptions;

    constructor(options: CommandConsoleOptions) {
        this.options = options;
    }

    public start() {
        this.printMultiline(this.options.header);

        this.printPrompt();
        process.stdin.addListener('data', data => {
            this.processCommand(data.toString());
        });
    }

    public processCommand(commandStr: string) {
        var fullCommand: string = commandStr.replace(/(\r\n|\n|\r)/gm, "");
        var commandParts: string[] = fullCommand.split(' ');

        var argStartIndex = 0;
        var currentCommand = this.options.commandRoot;
        var subcommand: Command;
        for (var i = 0; i < commandParts.length && (subcommand = currentCommand.getSubcommand(commandParts[i])) != null; i++) {
            argStartIndex += subcommand.name.length + 1;
            currentCommand = subcommand;
        }

        if (currentCommand.action != undefined) {
            var actionResult: Promise<any>;

            try {
                actionResult = currentCommand.action.apply(null, [fullCommand.substring(argStartIndex)].concat(commandParts.slice(i)));
            }
            catch (error) {
                actionResult = Promise.reject(error);
            }

            if (actionResult == undefined)
                this.reopenPrompt();
            else
                actionResult.then(() => {
                    this.reopenPrompt();
                }).catch(error => {
                    if (error instanceof Errors.Exception) {
                        if (this.options.warningExceptionCodes.indexOf((<Errors.Exception>error).exceptionCode) >= 0)
                            (<Errors.Exception>error).logAsWarning();
                        else if ((<Errors.Exception>error).exceptionCode === Errors.ExceptionCode.InvalidCommandParams)
                            (<Errors.Exception>error).logErrorMessage();
                        else
                            (<Errors.Exception>error).logErrorDetail();
                    }
                    else if (error instanceof Error) {
                        console.error(chalk.bgRed((<Errors.Error>error).message));
                        console.error('  ' + (<Errors.Error>error).stack);
                    }
                    else console.error(chalk.bgRed(error));

                    this.reopenPrompt();
                });
        }
        else {
            var subcommandNames = [];
            for (var subcommandIndex in currentCommand.subcommands)
                subcommandNames.push(currentCommand.subcommands[subcommandIndex].name);

            console.log('Available subcommands: ' + subcommandNames.join(', '));

            this.reopenPrompt();
        }
    }

    private reopenPrompt() {
        this.printPrompt();
    }

    private printPrompt() {
        process.stdout.write("\r\n> ");
    }

    private printMultiline(textLines: string[]) {
        process.stdout.write(textLines.join('\r\n') + '\r\n');
    }
}

export class CommandConsoleOptions {
    public commandRoot: Command;
    public header: string[];
    public warningExceptionCodes: Errors.ExceptionCode[] = [];
}

export class Command {
    public name: string;
    public action: (fullArgs: string, ...args: string[]) => void | Promise<any>;
    public subcommands: Command[];
    public helpText: string[];

    constructor(name: string, actionInfo?: ((fullArgs: string, ...args: string[]) => void | Promise<any>) | Command[], commandsArg?: Command[]) {
        this.name = name;

        if (_.isFunction(actionInfo)) {
            this.action = <(fullArgs: string, ...args: string[]) => void | Promise<any>> actionInfo;
            if (!_.isUndefined(commandsArg))
                this.subcommands = commandsArg;
        }
        else {
            this.subcommands = <Command[]>actionInfo;
        }
    }

    public getSubcommand(name: string) {
        for (var i in this.subcommands) {
            if (this.subcommands[i].name === name)
                return this.subcommands[i];
        }

        return null;
    }
}