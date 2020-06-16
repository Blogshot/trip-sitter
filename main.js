const { app, BrowserWindow } = require('electron')

const converter = require('./entrypoint.js')
require('log-timestamp');

var win

function createWindow () {
  
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true
    }
  })

  win.setMenu(null)
  //win.webContents.openDevTools()

  win.loadFile('index.html')

  setInterval(function () {

    var questWrapper = require('./utils/questWrapper')

    questWrapper.questIsConnected().then(data => {
      win.webContents.executeJavaScript(`document.getElementById('quest').style.backgroundColor = "green";`)
    }).catch(error => {
      console.log("Quest is not connected")
      win.webContents.executeJavaScript(`document.getElementById('quest').style.backgroundColor = "red";`)
    })

  }, 2000)

  // check if PC version is installed
  var locationPC = process.env.LOCALAPPDATA + "Low\\Kinemotik Studios\\Audio Trip\\Songs\\"

  var fs = require('fs')
  var pc = fs.existsSync(locationPC)

  if (pc) {
    win.webContents.executeJavaScript(`document.getElementById('pc').style.backgroundColor = "green";`)
  } else {
    win.webContents.executeJavaScript(`document.getElementById('pc').style.backgroundColor = "red";`)
  }
}

var ipc = require('electron').ipcMain;

ipc.on('onFile', function(event, data){    

  setLoading(true)

  for (var elem in data) {
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
    
    // kill adb before exiting
    require('adbkit').createClient( { bin: ".\\adb.exe" }).kill()
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