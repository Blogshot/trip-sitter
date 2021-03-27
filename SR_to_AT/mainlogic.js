const fs = require('fs')

module.exports = {

  convertFile: async function convertFile(filePath, tmpDir) {

    try {
      var extract = require('extract-zip')
      await extract(filePath, { dir: tmpDir })
    } catch (exception) {
      return { "error": true, "message": "The provided file (" + filePath + ") is either not a valid .synth or corrupt. Error:\n\n" + exception.message }
    }

    // extract audio metadata from tmpDir
    var audioFile = fs.readdirSync(tmpDir).filter(function (file) { return file.match(".*\.ogg") })[0]

    var mm = require('music-metadata');

    var metadataAudio = await mm.parseFile(tmpDir + audioFile)
    var duration = Math.floor(metadataAudio.format?.duration)

    if (duration == undefined) {
      return { "error": true, "message": "The provided audio file (" + tmpDir + audioFile + ") seems to be corrupt." }
    }

    // get JSON contents of dropped file
    var data = fs.readFileSync(tmpDir + "beatmap.meta.bin", { encoding: 'utf8' }).toString().trim()

    var json = JSON.parse(data.toString().trim())
    
    json.bpm = json.BPM
    json.offSetMS = 0
    json.duration = duration

    // create track events
    var metadata = this.createMetadata(json)

    var choreographies = this.createChoreographies(json)

    // aggregate all data into final JSON
    return {
      "error": false, 
      "data": {
        "metadata": metadata,
        "choreographies": choreographies
      }
    }
  },

  createMetadata: function createMetadata(json) {

    var metadata = new Object()

    metadata.custom = true
    metadata.authorID = {
      displayName: "Mapped by " + json.Beatmapper + " (converted from SynthRiders)"
    }
    metadata.songID = ""
    metadata.koreography = { "instanceID": 0 }
    metadata.sceneName = "Universal"
    metadata.title = json.Name
    metadata.artist = json.Author
    metadata.songFilename = json.AudioName
    metadata.tempoSections = new Array()
    metadata.songEventTracks = new Array()
    metadata.includeInArcades = true
    metadata.firstBeatTimeInSeconds = 0
    metadata.songEndTimeInSeconds = json.duration

    metadata.tempoSections.push({
      startTimeInSeconds: 0.0,
      beatsPerMeasure: 4,
      beatsPerMinute: json.bpm,
      doesStartNewMeasure: true
    })

    return metadata
  },

  createChoreographies: function createChoreographies(json) {
    var conversion_elements = require('./conversion_elements')
    var conversion_math = require('./conversion_math')

    var choreographies = new Object()
    choreographies.list = new Array()

    for (var difficulty in json.Track) {

      var Track = json.Track[difficulty]
      var Crouchs = json.Crouchs[difficulty]
      var Slides = json.Slides[difficulty]

      if (Track == null || Object.entries(Track).length == 0) {
        continue
      }

      var choreography = new Object()
      choreography.header = new Object()

      choreography.header.name = difficulty
      choreography.header.id = ""
      choreography.header.spawnAheadTime = { "beat": 8, "numerator": 0, "denominator": 1 }
      choreography.header.metadata = ""
      choreography.header.descriptor = ""
      choreography.header.gemSpeed = 20.0
      choreography.header.gemRadius = 1.0
      choreography.header.handRadius = 0.27000001072883608
      choreography.header.animClipPath = ""
      choreography.header.buildVersion = ""

      choreography.data = new Object()

      choreography.data.events = new Array()

      for (var trackElement in Track) {

        var currentTimestamp = Track[trackElement]

        for (var element in currentTimestamp) {

          // here we generate gems

          var currentElement = currentTimestamp[element]

          var event = conversion_elements.generateEvent(currentElement, json)

          // if the element is using both hands, just split it (and it's segments) into two gems
          if (currentElement.Type == 3 || currentElement.Type == 2) {

            var clone = conversion_elements.splitGem(event)
            choreography.data.events.push(clone)
          }

          event.newline = true
          choreography.data.events.push(event)

        }
      }

      var oldFormat = json.UsingBeatMeasure == undefined || !json.UsingBeatMeasure

      for (var crouchElement in Crouchs) {
        var currentCrouch = Crouchs[crouchElement]

        if (oldFormat) {
          currentCrouch = conversion_math.convertOldToNewFormat(currentCrouch, null)
        }

        var event = conversion_elements.generateCrouch(currentCrouch, json)

        event.newline = true

        choreography.data.events.push(event)
      }

      for (var slideElement in Slides) {
        var currentSlide = Slides[slideElement]

        if (oldFormat) {
          currentSlide = conversion_math.convertOldToNewFormat(currentSlide.time, currentSlide.slideType)
        }

        var event = conversion_elements.generateBarrier(currentSlide, json)

        event.newline = true

        choreography.data.events.push(event)
      }

      choreography.data.events.sort(function (a, b) {
        return a.bloggi - b.bloggi;
      })

      choreographies.list.push(choreography)

      for (var elem in choreographies.list) {

        for (var gem in choreographies.list[elem].data.events) {

          var currentGem = choreographies.list[elem].data.events[gem]

          // remove convenience attributes
          delete currentGem.bloggi
          delete currentGem.gemType
          delete currentGem.newline
          delete currentGem.hand

          //logGem(currentGem)
        }
      }
    }

    return choreographies
  },

  deployToGame: async function deployToGame(path, gameDir) {

    var audioFile = fs.readdirSync(path).filter(function (file) { return file.match(".*\.ogg") })[0]
    var atsFile = fs.readdirSync(path).filter(function (file) { return file.match(".*\.ats") })[0]

    // write audio file and generated song into custom song location
    if (fs.existsSync(gameDir)) {
      fs.copyFileSync(path + audioFile, gameDir + audioFile)
      fs.copyFileSync(path + atsFile, gameDir + atsFile)
    } else {
      fs.copyFileSync(path + atsFile, process.env.LOCALAPPDATA + "\\Programs\\trip-sitter\\output\\" + atsFile)
    }

    var questWrapper = require('./questWrapper')

    questWrapper.questIsConnected().then(data => {
      questWrapper.copyToQuest(path + audioFile, "AT")
      questWrapper.copyToQuest(path + atsFile, "AT")
    })

  },
}

