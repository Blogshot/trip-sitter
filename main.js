const { app, BrowserWindow } = require('electron')

const converter = require('./functions.js')

function createWindow () {
  // Erstelle das Browser-Fenster.
  let win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true
    }
  })

  win.setMenu(null)
  
  // und lade die index.html der App.
  win.loadFile('index.html')
}

var ipc = require('electron').ipcMain;

ipc.on('onFile', function(event, data){    

  converter.startConversion(data, function(successful) {
    if(successful) {
      event.sender.send('actionReply', successful.message);
    } else {
      event.sender.send('actionReply', "Error:\n" + successful.message);
    }
  })

});

app.whenReady().then(createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // Unter macOS ist es üblich, für Apps und ihre Menu Bar
  // aktiv zu bleiben, bis der Nutzer explizit mit Cmd + Q die App beendet.
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // Unter macOS ist es üblich ein neues Fenster der App zu erstellen, wenn
  // das Dock Icon angeklickt wird und keine anderen Fenster offen sind.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
