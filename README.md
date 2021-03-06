Destiny Character Management Console
================================
This app provides an easy-to-use interface for you to manage your Destiny inventory. It automates the process of moving weapons and other inventory items between characters without requiring you to enter the in-game Tower, letting you keep all your favorite things close at hand. We can maintain inventories of any size, with anywhere from one to three characters.

**NOTE:** This repo is no longer maintained and is not compatible with Destiny's Year Two ecosystem.

## Quick-start

### TL; DR
Either open the ManagerConsole project in Visual Studio or run the following commands from the same folder as `app.ts`:

```
> npm install
> npm install -g gulp
> gulp compile
> node app.js
```

If you see errors, stay calm and read all the instructions.

### Installation and setup
There are two ways that you can get the app ready to run. Both of them will require you to clone the repo, but from there you can either open the project in Visual Studio or compile and run the code from the command line. The instructions below will assume that you already have a local copy of this repo, and have [Node.js](https://nodejs.org/) installed.

#### Running from Visual Studio
To run the project from Visual Studio, install the [Node.js Tools for VS](https://nodejstools.codeplex.com/). Once those are installed, double-click the `destiny-character-manager/ManagerConsole/ManagerConsole/ManagerConsole.njsproj` file to open it. In the Solution Explorer, right-click on `npm` in the tree and select "Install Missing npm Packages". It will go off and install our dependencies. When it finishes, you should be able to click the "Start" button to launch the app.

#### Running from the command line
To compile and run the code from the command line (on any Node-supported OS), run the following commands from a terminal or CMD session in the `destiny-character-manager/ManagerConsole/ManagerConsole` folder:

```
> npm install
> npm install -g gulp
> gulp compile
> node app.js
```

That should install the dependencies (first two lines), compile the TypeScript into JavaScript (3rd line), and start the main app file with Node.

### Usage
Right now, our app has a command-line interface for managing gear. To access the console, start the program as described above. We will load information about your characters and vault from Destiny servers automatically, and then load the console when we're ready. You'll see some preliminary messages that are printed as the data is loaded.

```
Loading inventory data... this could take a few seconds
Inventory data loaded.
---------------------------------------------
Destiny character management console v0.1.0

>
```

Once the prompt (`>`) appears, it is ready to start accepting input. To see what you can type, check out the [Available commands](https://github.com/WasabiFan/destiny-character-manager/wiki/Available-commands) wiki page.

## So, how does it work?
** TODO **
