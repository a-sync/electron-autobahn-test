'use strict';

const {app, ipcMain, BrowserWindow} = require('electron');

global.AUTOBAHN_DEBUG = false;
const autobahn = require('autobahn');

require('electron-debug')();
require('electron-unhandled')();

let connection;
let mainWindow;
function startApp() {
    console.log('startApp');

    connection = new autobahn.Connection({
        url: 'ws://localhost:8080/ws',
        realm: 'realm1'
    });

    connection.onopen = function (session, details) {
        console.log('CONNECTION opened');
        global.abConnection = connection;
        global.abSession = session;
        global.abSessionDetails = details;

        connected();

        if (!mainWindow) createMainWindow();
    };

    connection.onclose = function (reason, details) {
        console.log('CONNECTION closed', reason, details);
    };

    connection.open();
}

function createMainWindow() {
    console.log('createMainWindow');

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            preload: require('path').join(__dirname, 'preload.js')
        }
    });

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('webContents did-finish-load');
        mainWindow.webContents.openDevTools();
    });
    mainWindow.on('closed', onClosed);

    let url = require('url').format({
        protocol: 'file',
        slashes: true,
        pathname: require('path').join(__dirname, 'index.html')
    });
    mainWindow.loadURL(url);
}

function onClosed() {
    console.log('WINDOW closed');
    mainWindow = null;

    let err = connection.close();
    if (err) console.log('error while closing connection', err);
}

function connected() {
    // SUBSCRIBE to a topic and receive events
    //
    global.abSession.subscribe('test.main.subscribe', mainSubscribe).then(
        function (sub) {
            console.log("subscribed to topic test.main.subscribe");
        },
        function (err) {
            console.log("failed to subscribe: ", err);
        }
    );

    // REGISTER a procedure for remote calling
    //
    global.abSession.register('test.main.register', mainRegister).then(
        function (reg) {
            console.log("procedure test.main.register registered");
        },
        function (err) {
            console.log("failed to register procedure: ", err);
        }
    );
}

function mainSubscribe (args, kwargs, details) {
    console.log('mainSubscribe', args, JSON.stringify(kwargs, null, 2), details);
}

function mainRegister (args, kwargs, details) {
    console.log('mainRegister', args, JSON.stringify(kwargs, null, 2), details);

    let re = {
        id: "return main.deepObj",
        deepObj: getDeepObj('mainRegister')
    };

    return re;
}

function mainPublish (v) {
    // PUBLISH an event
    //
    global.abSession.publish('test.main.publish', null, getDeepObj(v), {acknowledge: true}).then(
        function (res) {
            console.log("published to test.main.publish");
        },
        function (err) {
            console.log("failed to publish to test.main.publish", err);
        }
    );
}

function mainCall (v) {
    // CALL a remote procedure
    //
    global.abSession.call('test.main.call', null, getDeepObj(v)).then(
        function (res) {
            console.log("test.main.call called with result: ", JSON.stringify(res, null, 2));
        },
        function (err) {
            console.log("call of test.main.call failed: ", err);
        }
    );
}

function getDeepObj(id) {

    function getChilds(v) {
        return {
            child1: {
                id: "child1" + v,
                childs: {
                    child2: {
                        id: "child2" + v,
                        childs: {
                            child3: v
                        }
                    }
                }
            }
        };
    }
    return {
        id: id,
        more: [
            getChilds(1),
            [
                getChilds(2),
                [
                    {
                        deepKey: "deepValue",
                        deepArr: [
                            4,
                            3,
                            "deepArrValue",
                            {
                                deepChilds: getChilds(id),
                                val: ["val", "ue"]
                            }
                        ]
                    },
                    getChilds(3)
                ],
                2,
                1
            ]
        ],
        less: 0
    };
}

ipcMain.on('test.main.publish', (event, v) => {
    mainPublish(v);
});

ipcMain.on('test.main.call', (event, v) => {
    mainCall(v);
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
        console.log('APP window-all-closed');

		app.quit();
	}
});

app.on('activate', () => {
	if (!mainWindow) {
		startApp();
	}
});

app.on('ready', () => {
	startApp();
});
