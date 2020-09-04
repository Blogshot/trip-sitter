const { app, shell,  BrowserWindow } = require('electron');

require('log-timestamp');

var win
var debug = true

var pcCheck
var questCheck

function createWindow() {

  win = new BrowserWindow({
    width: 900,
    height: 550,
    webPreferences: {
      nodeIntegration: true
    }
  })

  if (debug) {
    win.setMenu(null)
    win.webContents.openDevTools()
    win.setSize(1200, 900)
  }
  win.setResizable(debug)

  win.loadFile('index.html')

  var questStatus = null;
  var questTmpStatus = false;

  // Open links in the system's default Browser
  win.webContents.on('new-window', (e, url) => {
    e.preventDefault()
    shell.openExternal(url)
  })

  // Check if quest is connected every 2 seconds
  questCheck = setInterval(function () {

    var questWrapper = require('./utils/questWrapper')

    questWrapper.questIsConnected().then(data => {
      win.webContents.executeJavaScript(`document.getElementById('quest').style.backgroundColor = "green";`)
    }).catch(error => {
      questTmpStatus = false
      win.webContents.executeJavaScript(`document.getElementById('quest').style.backgroundColor = "red";`)
    })

    // only print to console if status changes OR on first check
    if (questStatus != questTmpStatus || questStatus == null) {
      questStatus = questTmpStatus;

      // if questStatus is not true, insert "not"
      console.log("Quest is" + (questStatus ? "" : " not") + " connected")
    }

  }, 2000)

  pcCheck = setInterval(function () {

    // check if PC version is installed
    var locationPC = process.env.LOCALAPPDATA + "Low\\Kinemotik Studios\\Audio Trip\\Songs\\"

    var fs = require('fs')
    var pc = fs.existsSync(locationPC)

    if (pc) {
      win.webContents.executeJavaScript(`document.getElementById('pc').style.backgroundColor = "green";`)
    } else {
      win.webContents.executeJavaScript(`document.getElementById('pc').style.backgroundColor = "red";`)
    }

  }, 2000)

  // check for update on start
  checkUpdate();
}

var ipc = require('electron').ipcMain;

ipc.on('onFile', function(event, data){

  setLoading(true)

  // date is an array of paths to the dropped files
  for (var elem in data) {

    // start processing for each path
    var converter = require('./entrypoint.js')
    converter.startProcessing(data[elem], function(error) {

      // callback is only for error messages
      event.sender.send('actionReply', error);
    })
  }

  setLoading(false)

});

app.whenReady().then(createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    clearInterval(questCheck);
    clearInterval(pcCheck);

    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

function setLoading(bool) {

  if (bool) {
    win.webContents.executeJavaScript(`document.getElementById("dropLogo").style.display = "none";`)
    win.webContents.executeJavaScript(`document.getElementById("spinner").style.removeProperty('display');`)
  } else {
    win.webContents.executeJavaScript(`document.getElementById("spinner").style.display = "none";`)
    win.webContents.executeJavaScript(`document.getElementById("dropLogo").style.removeProperty('display');`)
  }
}

function checkUpdate() {

  var https = require('https')

  const options = {
    hostname: 'api.github.com',
    path: '/repos/Blogshot/trip-sitter/releases/latest',
    headers: { 'User-Agent': 'console' }
  };

  var data = "";

  https.get(options, response => {

    // response is glued together from chunks
    response.on('data', function (body) {
      data += body
    });

    // after response is complete
    response.on('end', () => {

      // check for status code (detection of rate limits, etc.)
      if (response.statusCode != 200) {
        console.log("Statuscode was: " + response.statusCode + " instead of 200. Response:\n" + JSON.stringify(JSON.parse(data), null, 2))
        return
      }

      // get version numbers
      var pjson = require('./package.json');
      var local = pjson.version.split(".");
      var remote = JSON.parse(data).tag_name.substr(1).split(".");
      
      // If debug is disabled and update available, show button
      if (!debug && updateAvailable(local, remote)) {
        win.webContents.executeJavaScript(`document.getElementById("update").style.visibility = "visible";`)
      }
    });

  }).on('error', (e) => {
    console.error(e);
  });
}

function updateAvailable(local, remote) {

  if (local[0] < remote[0]) {
    console.log("Major version available")
    return true
  } else if (local[1] < remote[1]) {
    console.log("Minor version available")
    return true
  } else if (local[2] < remote[2]) {
    console.log("Patch version available")
    return true
  }

  console.log("Now new version available")
  return false
}