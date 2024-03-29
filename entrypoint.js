const fs = require('fs')

module.exports = {

  startProcessing: function startProcessing(filePath, callback) {

    // filename = songname.ats / songname.synth / songname.ogg
    var fileName = filePath.substr(filePath.lastIndexOf("\\") + 1)
    var suffix = fileName.substr(fileName.length - fileName.substr(fileName.lastIndexOf(".")).length)

    // tmpdir = \Programs\trip-sitter\tmp_songname-without-suffix\
    var tmpDir = process.env.LOCALAPPDATA + "\\Programs\\trip-sitter\\tmp_" + fileName.substr(0, fileName.length - suffix.length).split(".").join("_") + "\\"
    var locationPC
    var converter;

    var fallbackDir = process.env.LOCALAPPDATA + "\\Programs\\trip-sitter\\output\\"
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir);
    }

    if (suffix == ".synth") {
      converter = require('./SR_to_AT/mainlogic')
      locationPC = process.env.LOCALAPPDATA + "Low\\Kinemotik Studios\\Audio Trip\\Songs\\"
    } else if (suffix == ".ats") {
      converter = require('./AT_to_SR/mainlogic')
      locationPC = "unknown"
    } else {
      callback({
        "error": true,
        "message": "The file type of '" + fileName + "' not valid."
      })
    }

    converter.convertFile(filePath, tmpDir).then(result => {
      if (result.error) {
        callback({
          "error": true,
          "message": result.message
        })
        return
      }

      if (suffix == ".synth") {

        var mapper = result.data.metadata.authorID_SR

        // result is ats json
        fs.writeFileSync(tmpDir + result.data.metadata.songFilename.replace(mapper + "_", "").replace(".ogg", ".ats"), JSON.stringify(result.data, null, 2))

        // deploy ats and ogg
        converter.deployToGame(tmpDir, locationPC, fallbackDir, mapper)
        fs.rmdirSync(tmpDir, { recursive: true });

      } else if (suffix == ".ats") {

        // result is beatmap.meta.bin json
        fs.writeFileSync(tmpDir + "beatmap.meta.bin", JSON.stringify(result.data, null, 2))

        // pack files into .synth
        converter.pack(tmpDir, result.data.Name + ".synth").then(synthPath => {

          // deploy synth
          converter.deployToGame(synthPath, locationPC)
          fs.rmdirSync(tmpDir, { recursive: true });
        }).catch(error => {
          callback({
            "error": true,
            "message": error
          })
        })
      }

      callback({
        "error": false,
        "message": locationPC
      })
    })

  }
}







