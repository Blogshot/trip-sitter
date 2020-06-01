const { app, BrowserWindow } = require('electron')

const converter = require('./functions.js')

function createWindow () {
  
  let win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true
    }
  })

  win.setMenu(null)
  
  win.loadFile('index.html')
}

var ipc = require('electron').ipcMain;

ipc.on('onFile', function(event, data){    

  converter.startConversion(data, function(successful) {
    if(successful.result) {
      event.sender.send('actionReply', successful.message);
    } else {
      event.sender.send('actionReply', "Error:\n" + successful.message);
    }
  })

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
