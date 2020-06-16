const fs = require('fs')

module.exports = {

  startProcessing: function startProcessing(filePath, callback) {

    var fileName = filePath.substr(filePath.lastIndexOf("\\") + 1)
    var suffix = fileName.substr(fileName.length - fileName.substr(fileName.lastIndexOf(".")).length)

    var tmpDir = process.env.LOCALAPPDATA + "\\Programs\\trip-sitter\\tmp_" + fileName.substr(0, fileName.length - suffix.length) + "\\"
    
    if (suffix == ".synth") {

      var converter = require('./SR_to_AT/mainlogic')    

      // ats
      var result = converter.convertSynthridersFile(filePath, tmpDir)

      if (result.error) {
        callback(result.data)
        return
      }

      // write result to tmpdir for further processing
      fs.writeFileSync(tmpDir + ats.metadata.title + ".ats", JSON.stringify(result.data, null, 2))

      // deploy ats and ogg
      converter.deployToGame(tmpDir)

    } else if (suffix == ".ats") {

      var converter = require('./AT_to_SR/mainlogic')

      // beatmap.meta.bin
      var result = converter.convertAudioTripFile(filePath, tmpDir)

      if (result.error) {
        callback(result.data)
        return
      }

      // write result to tmpdir for further processing
      fs.writeFileSync(tmpDir + "beatmap.meta.bin", JSON.stringify(result.data, null, 2))

      // pack files into .synth
      converter.pack(tmpDir, ats.metadata.title + ".synth").then(synthPath => {
        // deploy synth
        converter.deployToGame(synthPath)
      }).catch(error => {
        // TODO

      })


    }
  }
}







