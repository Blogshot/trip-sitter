const { app, BrowserWindow } = require('electron')

require('log-timestamp');

var win

function createWindow () {
  
  win = new BrowserWindow({
    width: 900,
    height: 550,
    webPreferences: {
      nodeIntegration: true
    }
  })

  win.setMenu(null)
  win.setResizable(false)
  //win.webContents.openDevTools()

  win.loadFile('index.html')

  // Check if quest is connected every 2 seconds
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