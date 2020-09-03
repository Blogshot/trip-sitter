const fs = require('fs')

module.exports = {

  startProcessing: function startProcessing(filePath, errorCallback) {

    // filename = songname.ats / songname.synth / songname.ogg
    var fileName = filePath.substr(filePath.lastIndexOf("\\") + 1)
    var suffix = fileName.substr(fileName.length - fileName.substr(fileName.lastIndexOf(".")).length)

    // tmpdir = \Programs\trip-sitter\tmp_songname-without-suffix\
    var tmpDir = process.env.LOCALAPPDATA + "\\Programs\\trip-sitter\\tmp_" + fileName.substr(0, fileName.length - suffix.length) + "\\"

    var converter;

    if (suffix == ".synth") {
      converter = require('./SR_to_AT/mainlogic')
    } else if (suffix == ".ats") {
      converter = require('./AT_to_SR/mainlogic')
    } else {
      errorCallback("The file type of '" + fileName + "' not valid.")
    }

    var result = converter.convertFile(filePath, tmpDir)

    if (result.error) {
      errorCallback(result.data)
      return
    }

    if (suffix == ".synth") {

      // result is ats json
      fs.writeFileSync(tmpDir + result.metadata.title + ".ats", JSON.stringify(result.data, null, 2))

      // deploy ats and ogg
      converter.deployToGame(tmpDir)

    } else if (suffix == ".ats") {

      // result is beatmap.meta.bin json
      fs.writeFileSync(tmpDir + "beatmap.meta.bin", JSON.stringify(result.data, null, 2))

      // pack files into .synth
      converter.pack(tmpDir, result.data.Name + ".synth").then(synthPath => {
        
        // deploy synth
        converter.deployToGame(synthPath)

      }).catch(error => {
        errorCallback(error)
      })

    }
  }
}







