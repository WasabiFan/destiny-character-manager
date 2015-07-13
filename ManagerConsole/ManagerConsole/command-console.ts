var sys = require('sys');

export class CommandConsole {
    private options: CommandConsoleOptions;

    constructor(options: CommandConsoleOptions) {
        this.options = options;
    }

    public start() {
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
            currentCommand.action.apply(null, [fullCommand.substring(argStartIndex)].concat(commandParts.slice(i)));
        }

        this.printPrompt();
    }

    private printPrompt() {
        process.stdout.write("\r\n> ");
    }
}

export class CommandConsoleOptions {
    public commandRoot: Command;
}

export class Command {
    public name: string;
    public action: (fullArgs: string, ...args: string[]) => void;
    public subcommands: Command[];

    constructor(name: string, actionInfo: ((fullArgs: string, ...args: string[]) => void) | Command[]) {
        this.name = name;

        if (typeof actionInfo === 'function') {
            this.action = <(fullArgs: string, ...args: string[]) => void> actionInfo;
        }
        else {
            this.subcommands = <Command[]> actionInfo;
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