module.exports = {

  questIsConnected: function questIsConnected() {

    return new Promise((resolve, reject) => {

      const { exec } = require('child_process');

      exec('((New-Object -com Shell.Application).NameSpace(0x11).items() | where { $_.name -eq "Quest" }).Path', { 'shell': 'powershell.exe' }, (error, stdout, stderr) => {
        
        if (!stderr && !error) {
          resolve(stdout)
        } else {
          reject("PowerShell stderr: " + stderr)
        }
      })
    })
  },

  copyToQuest: function copyToQuest(path, file, game) {
    const powershell = require('node-powershell');

    // Create the PS Instance
    let ps = new powershell({
      executionPolicy: 'Bypass',
      noProfile: false
    })

    if (game == "AT") {
      ps.addCommand("./copyViaMTP_AT.ps1")
    } 
    if (game == "SR") {
      ps.addCommand("./copyViaMTP_SR.ps1")
    } 

    ps.addParameters([
      { name: "sourcePath", value: path },
      { name: 'filter', value: file }
    ]);

    ps.invoke().then(output => {
      console.log(output)
    }).catch(err => {
      console.error(err)
      ps.dispose()
    })

  }
}