'use strict';

const electron = require('electron');
const {app, ipcMain} = require('electron');

global.AUTOBAHN_DEBUG = false;
const autobahn = require('autobahn');

require('electron-debug')();
require('electron-unhandled')();

let connection;
function run() {
    connection = new autobahn.Connection({
       url: 'ws://localhost:8080/ws',
       realm: 'realm1'}
    );

    connection.onopen = function (_session) {
        connected(_session);
    };

    mainWindow = createMainWindow();
    mainWindow.on('show', e => {
        connection.open();
    });
}

function connected(session) {
    global.abSession = session;

    // SUBSCRIBE to a topic and receive events
    //
    session.subscribe('test.main.subscribe', mainSubscribe).then(
      function (sub) {
         console.log("subscribed to topic 'test.main.subscribe'");
      },
      function (err) {
         console.log("failed to subscribe: " + err);
      }
    );

    // REGISTER a procedure for remote calling
    //
    session.register('test.main.register', mainRegister).then(
      function (reg) {
         console.log("procedure test.main.register registered");
      },
      function (err) {
         console.log("failed to register procedure: " + err);
      }
    );
}

function mainSubscribe (args, kwargs, details) {
    console.info('mainSubscribe', args, kwargs, details);
}

function mainRegister (args, kwargs, details) {
    console.info('mainRegister', args, kwargs, details);

    let re = {
        id: "return deepObj",
        deepObj: getDeepObj()
    };

    return re;
}

function getDeepObj() {
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
    return [
        getChilds(0),
        {
            more: [
                getChilds(1),
                [
                    getChilds(2),
                    [
                        {
                            deepKey:"deepValue",
                            deepArr:
                            [
                                4,
                                3,
                                "deepArrValue",
                                {
                                    deepChilds: getChilds("test"),
                                    val: ["val","ue"]
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
        }
    ];
}

ipcMain.on('test.publish', (event, v) => {
    // PUBLISH an event
    //
    global.abSession.publish('test.main.publish', null, getDeepObj(v));
    console.log("published to 'test.main.publish' with v " + v);
});

ipcMain.on('test.call', (event, v) => {
      // CALL a remote procedure
      //
      session.call('test.main.call', null, getDeepObj(v)).then(
         function (res) {
            console.log("test.main.call called with result: " + res);
         },
         function (err) {
            console.log('call of test.main.call failed: ' + err);
         }
      );
});

let mainWindow;
function onClosed() {
	mainWindow = null;
}

function createMainWindow() {
	const win = new electron.BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
            nodeIntegration: false,
            preload: `${__dirname}/preload.js`
		}
	});

	win.loadURL(`file://${__dirname}/index.html`);
	win.on('closed', onClosed);

	return win;
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (!mainWindow) {
		run();
	}
});

app.on('ready', () => {
	run();
});
