var sys = require('sys');

export class CommandConsole {
    private options: CommandConsoleOptions;

    constructor(options: CommandConsoleOptions) {
        this.options = options;
    }

    public start() {
        process.stdin.addListener('data', data => {
            var commandParts: string[] = data.toString().replace(/(\r\n|\n|\r)/gm, "").split(' ');

            var currentCommand = this.options.commandRoot;
            var subcommand;
            for (var i = 0; i < commandParts.length && (subcommand = currentCommand.getSubcommand(commandParts[i + 1])) != null; i++) {
                currentCommand = subcommand;
            }

            if (currentCommand.action != undefined) {
                currentCommand.action.apply(this, commandParts.slice(i + 1));
            }
        });
    }
}

export class CommandConsoleOptions {
    public commandRoot: Command;
}

export class Command {
    public name: string;
    public action: (...args: string[]) => string | void;
    public subcommands: Command[];

    constructor(name: string, actionInfo: ((...args: string[]) => string | void) | Command[]) {
        this.name = name;

        if (typeof actionInfo === 'function') {
            this.action = <(...args: string[]) => string | void> actionInfo;
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