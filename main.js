const { app, shell,  BrowserWindow } = require('electron');

require('log-timestamp');

var win
var debug = false

var pcCheck
var questCheck

function createWindow() {

  win = new BrowserWindow({
    width: 900,
    height: 580,
    webPreferences: {
      nodeIntegration: true
    }
  })

  if (debug) {
    win.webContents.openDevTools()
    win.setSize(1200, 900)
  } else {
    win.setMenu(null)
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

    // check if AT is installed
    var locationPC_AT = process.env.LOCALAPPDATA + "Low\\Kinemotik Studios\\Audio Trip\\Songs\\"

    // need logic to get SR custom song location
    var locationPC_SR = "C:\\"

    var fs = require('fs')
    var at = fs.existsSync(locationPC_AT)
    var sr = fs.existsSync(locationPC_SR)

    if (at) {
      win.webContents.executeJavaScript(`document.getElementById('at').style.backgroundColor = "green";`)
    } else {
      win.webContents.executeJavaScript(`document.getElementById('at').style.backgroundColor = "red";`)
    }

    if (sr) {
      win.webContents.executeJavaScript(`document.getElementById('sr').style.backgroundColor = "yellow";`)
    } else {
      win.webContents.executeJavaScript(`document.getElementById('sr').style.backgroundColor = "red";`)
    }

  }, 2000)

  // check for update on start
  checkUpdate();
}

var ipc = require('electron').ipcMain;

var looperArray
var converter = require('./entrypoint.js')

ipc.on('onFile', function(event, data){

  looperArray = data

  setLoading(true)

  event.sender.send('resetErrors')

  // start with first 
  event.sender.send('actionProgress', 0 + "/" + data.length)
  looper(event, looperArray[0], 0, data.length) 
});

function looper(event, elem, counter, target) {

  // start processing
  converter.startProcessing(elem, function(result) {
    counter++

    event.sender.send('actionProgress', counter + "/" + target)

    if (result.error) {
      event.sender.send('actionError', result.message)
    }
    
    if (counter == target) {
      setLoading(false)
      event.sender.send('actionSuccess', "The files have been converted and were saved in: " + result.message)
    } else {
      // delete first item, then enter next loop with new first item
      looperArray = looperArray.splice(1)
      looper(event, looperArray[0], counter, target)
    }
  })
}

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