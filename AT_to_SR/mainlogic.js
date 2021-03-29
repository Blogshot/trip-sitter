const fs = require('fs')

module.exports = {

  convertFile: function convertFile(filePath, tmpDir) {

    // extract audio metadata from tmpDir
    var audioFile = fs.readdirSync(tmpDir).filter(function (file) { return file.match(".*\.ogg") })[0]

    var mm = require('music-metadata');

    var metadataAudio = await mm.parseFile(tmpDir + audioFile)
    var duration = Math.floor(metadataAudio.format?.duration)
    var bitrate = Math.floor(metadataAudio.format?.bitrate)

    if (duration == undefined) {
      return { "error": true, "message": "The provided audio file (" + tmpDir + audioFile + ") seems to be corrupt." }
    }

    // get JSON contents of dropped file
    var data = fs.readFileSync(filePath, { encoding: 'utf8' }).toString().trim()

    var metadata = JSON.parse(data.toString().trim())

    // create track events
    var track = createTrack(metadata.choreographies)
    var crouchs = createCrouchs(metadata.choreographies)
    var slides = createSlides(metadata.choreographies)

    // aggregate all data into final JSON

    return {
      "error": false,
      "data": {
        "Name": metadata.title,
        "Author": metadata.artist,
        "AudioName": metadata.songFilename,
        "AudioFrecuency": bitrate,
        "BPM": metadata.tempoSections[0].beatsPerMinute,
        "Track": track,
        "Effects": {},
        "Bookmarks": {},
        "Jumps": {},
        "Crouchs": crouchs,
        "Slides": slides,
        "Lights": {},
        "Beatmapper": "Mapped by " + metadata.authorID.displayName + " (converted from SynthRiders)",
        "DrumSamples": null,
        "FilePath": "",
        "IsAdminOnly": false,
        "EditorVersion": "trip-sitter",
        "CustomDifficultyName": "Custom",
        "CustomDifficultySpeed": 1.0,
        "UsingBeatMeasure": true,
        "UpdatedWithMovementPositions": true,
        "ProductionMode": true,
        "Tags": [],
        "BeatConverted": true,
        "ModifiedTime": parseInt((Date.now() / 1000))
      }
    }
  },

  createTrack: function createTrack(choreographies) { },
  createCrouchs: function createCrouchs(choreographies) { },
  createSlides: function createSlides(choreographies) { },

  pack: function pack(tmpDir, target) {

    return new Promise((resolve, reject) => {

      // TODO
      // pack ogg and beatmap.meta.bin into a .synth file

      resolve(tmpDir + target)

      reject()

    })

  },

  deployToGame: async function deployToGame(path, gameDir, fallbackDir, mapper) {

    var synth = fs.readdirSync(path).filter(function (file) { return file.match(".*\.synth") })[0]

    // write synth into custom song locations

    // check if PC version is installed
    /*
    var locationPC = "STEAMDIR"

    if (fs.existsSync(locationPC)) {
      fs.copyFileSync(path + synth, locationPC + synth)
    } else {
      fs.copyFileSync(path + synth, process.env.LOCALAPPDATA + "\\Programs\\trip-sitter\\output\\" + synth)
    }
    */
    fs.copyFileSync(path + synth, fallbackDir + mapper + "_" + synth)

    /*
    var questWrapper = require('./questWrapper')

    questWrapper.questIsConnected().then(data => {
      questWrapper.copyToQuest(path + synth, "SR")
    })
    */
  }
}

