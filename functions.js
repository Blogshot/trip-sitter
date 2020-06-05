const fs = require('fs')

var offSetMS
var bpm

// make available globally
var locationPC = process.env.LOCALAPPDATA + "Low\\Kinemotik Studios\\Audio Trip\\Songs\\"
var outputDir = process.env.LOCALAPPDATA + "\\Programs\\trip-sitter\\output\\"
var tmpDir

// check if PC version is installed
var pc = fs.existsSync(locationPC)
// check if Quest is connected
var quest = false

module.exports = {

  reduce: function reduce(numerator, denominator) {

    // shamelessly stolen from https://stackoverflow.com/a/4652513
    var gcd = function gcd(a, b) {
      return b ? gcd(b, a % b) : a;
    };

    gcd = gcd(numerator, denominator);

    return [numerator / gcd, denominator / gcd];
  },

  calcBeatFromMillis: function calcBeatFromMillis(ms) {

    // 3 decimal places -> microseconds. Very precise
    // 0 decimal places -> milliseconds. Precise enough
    var precision = 0

    // calculate the ms per beat
    var beat_interval = (60000 / bpm).toFixed(precision)

    // calculate the beat of the input ms (including offSet)
    var beat = Math.floor((ms-offSetMS) / beat_interval)

    // now calculate the remainder to get the sub-beat
    var remainder = ms % beat_interval;

    // default to the "whole beat" specification
    var reduced = [0, 1]

    if (remainder != 0) {
      // convert the remainder to a fracture of 1, which return an inexact float value (eg. 0.7499~)
      var remainderRelative = remainder / beat_interval

      // round the inexact remainder to the nearest 1/16th 
      var possibleFractionsPerBeat = 32
      var roundedNum = (Math.round(remainderRelative * possibleFractionsPerBeat) / possibleFractionsPerBeat).toFixed(5)

      // multiply by "possibleFractionsPerBeat" to convert the fracture of 1 to a numerator for a denominator of 16
      var numerator = roundedNum * possibleFractionsPerBeat

      // reduce to the smallest denominator by finding the 
      var reduced = this.reduce(numerator, possibleFractionsPerBeat)
    }

    if (reduced[0] == reduced[1]) {
      reduced[0] = 0
      reduced[1] = 1
    }

    return {
      "beat": beat,
      "numerator": reduced[0],
      "denominator": reduced[1],
    }
  },

  calcMSFromZ: function calcMSFromZ(z) {
    // https://github.com/klugeinteractive/synth-riders-editor/blob/master/Assets/MikuEditor/Scripts/MiKu/NET/Track.cs#L4331
    return (z / 20) * 1000
  },

  calcZFromMS: function calcZFromMS(ms) {
    return (ms / 1000) * 20
  },

  generateCrouch: function generateCrouch(currentElement) {

    // modify element to have an additional "custom" slideType
    currentElement.slideType = 5

    // business as usual
    return this.generateBarrier(currentElement)
  },

  generateBarrier: function generateBarrier(currentElement) {

    var event = new Object()

    event.type = 0

    event.position = new Object()

    event.position.x = 0 // not used for barriers
    event.position.y = 0 // vertical offset of the barrier

    switch (currentElement.slideType) {
      case 0:
        event.hand = "right"
        event.position.y = 0.3
        event.position.z = -90
        // barrier right side
        break
      case 1:
        event.hand = "left"
        event.position.z = 90
        event.position.y = 0.3
        // barrier left side        
        break
      case 2:
        event.hand = "right diag"
        event.position.y = 0.2
        event.position.z = -45
        break;
      case 3:
        event.hand = "center"
        // barrier center
        break;
      case 4:
        event.hand = "left diag"
        event.position.z = 45
        event.position.y = 0.2
        // barrier left diagonal                
        break
      case 5:
        // only possible via generateCrouch()
        event.hand = "crouch"
        event.position.y = 0.4 // a bit higher than shoulder level
        event.position.z = 0
        break;
    }

    event.hasGuide = false
    event.bloggi = currentElement.position[2]
    event.beatDivision = 2
    event.broadcastEventID = 0

    event.time = this.calcBeatFromMillis(this.calcMSFromZ(currentElement.position[2]))

    event.gemType = "barrier"

    return event;
  },

  generateEvent: function generateEvent(currentElement) {

    var event = new Object()

    event.position = new Object()

    event.position.z = 0

    switch (currentElement.Type) {
      case 0:
        event.type = 2
        event.hand = "right"
        break
      case 1:
        event.type = 1
        event.hand = "left"
        break
      case 2:
        event.hand = "one any"
        break;
      case 3:
        event.hand = "both"
        break;
    }

    event.hasGuide = false
    event.bloggi = currentElement.Position[2]
    event.beatDivision = 2
    event.broadcastEventID = 0

    var convertedCoords = this.convertXY(currentElement.Position[0].toFixed(2), currentElement.Position[1].toFixed(2))

    event.position.x = convertedCoords.x
    event.position.y = convertedCoords.y

    event.time = this.calcBeatFromMillis(this.calcMSFromZ(currentElement.Position[2]))

    event.position.z = 0

    event.subPositions = new Array()

    // if there are no segments, the event type is gem and we are finished
    if (currentElement.Segments == null) {
      event.gemType = "gem"
      return event;
    }

    // otherwise, this is a ribbon
    event.type += 2
    event.gemType = "ribbon"

    // add starting point of the spline
    event.subPositions.push(
      {
        "x": 0,
        "y": 0,
        "z": 0
      }
    )

    // get start and end position of the ribbon
    var start = currentElement.Position[2]
    var max = Math.max.apply(Math, currentElement.Segments.map(function (o) { return o[2]; }))
    var length = max - start

    var length_ms = this.calcMSFromZ(length)

    // for short ribbons (< 1 beat) we may need additional positions, so we increase beatdivision
    if (this.calcBeatFromMillis(length_ms).beat == 0) {
      event.beatDivision = 4
    }

    var length_beatDivision = (60000 / bpm).toFixed(0) / event.beatDivision

    var checkPoints = new Array()

    // go through the length of the ribbon and mark the spots (in ms) for new checkpoints
    while (length_ms > length_beatDivision) {

      length_ms -= length_beatDivision

      checkPoints.push(length_ms)
    }

    for (var checkpoint in checkPoints) {

      var currentCheckpoint = checkPoints[checkpoint]

      // find the nearest checkpoint in SynthRiders' format
      var goal = this.calcZFromMS(currentCheckpoint) + start

      var mindiff
      var prevmin = -1
      var closest

      for (var tmp_segment in currentElement.Segments) {
        var currentZ = currentElement.Segments[tmp_segment][2]

        // get the absolute difference between the current element and the goal
        mindiff = Math.abs(currentZ - goal)

        // if the diff grew, exit the loop -> prevmin is our result!
        if (mindiff > prevmin && prevmin != -1) {
          continue; // was break; (revert if this breaks anything)
        } else {
          prevmin = mindiff
          closest = currentElement.Segments[tmp_segment]
        }
      }

      var subPosition = new Object()

      var XY = this.convertXY(closest[0], closest[1], true)
      subPosition.x = XY.x*2/3
      subPosition.y = XY.y*2/3
      subPosition.z = "unused"

      event.subPositions.push(subPosition)
    }

    return event;
  },

  convertXY: function convertXY(x, y, OnlyOffset = false) {

    /*
      This function converts the coordinates of SynthRiders to AudioTrip
    */



    /*
      (SR) The center of the arena is (0|0).
      (AT) The center of the arena is (0|1.38), so we need to add Ashley's height to the Y for correct coordinates
    
      Synthrider min/max positional values
      X: +- 1.0
      Y: +- 0.7

      AudioTrip min/max positional values. 
      X: +- 1.5
      Y: 0, 2.6

      The X-Coordinate can roughly be translated via f(x) = 1.5x
      f(-1) = 1.5 * -1 = -1.5
      f( 0) = 1.5 *  0 =  0
      f( 1) = 1.5 *  1 =  1.5

      The Y-Coordinate can roughly  be translated via g(y) = 1.8y + 1.38
      g(-0.7) = 1.8 * -0.7 + 1.38 = 0.12
      g( 0  ) = 1.8 *  0   + 1.38 = 1.38
      g( 0.7) = 1.8 *  0.7 + 1.38 = 2.64

      Special thanks to https://www.desmos.com/calculator ;)

      It turns out that the formulars are correct, but to achieve comfortable spacing, they needed some tweaking. 
      - The variable (x,y) changes the spacing between gems
      - for g(y), the last part tweaks the Y-coordinates point of reference

      The following are the final formulars that seem good:
      f(x) = 0.7x
      g(y) = 0.8y + 1.2
    */

    var resultX = (0.7*x).toFixed(2)
    var resultY = (0.6*y + (OnlyOffset ? 0.0 : 1.2)).toFixed(2)

    //console.log("(" + (x>=0 ? " " : "") + x + " |" + (y>=0 ? " " : "") + y + ")\t->\t(" + (resultX>=0 ? " " : "") + resultX + "|" + (resultY>=0 ? " " : "") + resultY + ")")

    return {
      "x": resultX,
      "y": resultY
    }
  },

  logGem: function logGem(currentGem) {
    var ms = this.calcMSFromZ(currentGem.bloggi)
    var tmp = this.calcBeatFromMillis(ms)

    console.log(
      currentGem.bloggi.toFixed(5) + "m " +
      ((this.calcMSFromZ(currentGem.bloggi)) / 1000).toFixed(2) + "s (" + tmp.beat + " - " + tmp.numerator + "/" + tmp.denominator + ") / " + 147 +
      "s  \t->\t" +
      (currentGem.position.x >= 0.0 ? " " : "") + (Math.round(currentGem.position.x * 100) / 100).toFixed(2) + "x |" +
      (currentGem.position.y >= 0.0 ? " " : "") + (Math.round(currentGem.position.y * 100) / 100).toFixed(2) + "y\t" +
      currentGem.hand + " " + currentGem.gemType + (currentGem.newline ? "\n" : "")
    )
  },

  splitGem: function splitGem(event) {

    // clone base element
    var supportEvent = JSON.parse(JSON.stringify(event))
    var offsetX = 0.15
    var ribbon = event.gemType == "ribbon"

    // supportEvent will be left, the original event right
    supportEvent.position.x -= offsetX
    supportEvent.type = ribbon ? 3 : 1
    supportEvent.hand = "left (split)"

    event.position.x += offsetX
    event.type = ribbon ? 4 : 2
    event.hand = "right (split)"

    // supportEvent will be left, the original event right
    for (var subPosition in event.subPositions) {

      var currentSubPosition = event.subPositions[subPosition]

      currentSubPosition.x += offsetX
    }

    for (var subPosition in supportEvent.subPositions) {

      var currentSubPosition = supportEvent.subPositions[subPosition]

      currentSubPosition.x -= offsetX
    }

    return supportEvent

  },

  convertSynthridersFile: function convertSynthridersFile(data, duration) {

    var json = JSON.parse(data.toString().trim())

    var oldFormat = json.UsingBeatMeasure == undefined || !json.UsingBeatMeasure

    bpm = json.BPM
    offSetMS = json.Offset

    var metadata = new Object()
    metadata.custom = true
    metadata.authorID = {}
    metadata.songID = ""
    metadata.koreography = { "instanceID": 0 }
    metadata.sceneName = "Universal"
    metadata.title = `${json.Name} (Converted SR map by ${json.Beatmapper})`
    metadata.artist = json.Author
    metadata.songFilename = json.AudioName
    metadata.tempoSections = new Array()
    metadata.songEventTracks = new Array()
    metadata.includeInArcades = true
    metadata.firstBeatTimeInSeconds = 0
    metadata.songEndTimeInSeconds = duration

    metadata.tempoSections.push({
      startTimeInSeconds: 0.0,
      beatsPerMeasure: 4,
      beatsPerMinute: bpm,
      doesStartNewMeasure: true
    })

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

          var event = this.generateEvent(currentElement, trackElement)

          // if the element is using both hands, just split it (and it's segments) into two gems
          if (currentElement.Type == 3 || currentElement.Type == 2) {

            var clone = this.splitGem(event)
            choreography.data.events.push(clone)
          }

          event.newline = true
          choreography.data.events.push(event)

        }
      }

      for (var crouchElement in Crouchs) {
        var currentCrouch = Crouchs[crouchElement]

        if (oldFormat) {
          currentCrouch = this.convertOldToNewFormat(currentCrouch, null)
        }

        var event = this.generateCrouch(currentCrouch)

        event.newline = true

        choreography.data.events.push(event)
      }

      for (var slideElement in Slides) {
        var currentSlide = Slides[slideElement]

        if (oldFormat) {
          currentSlide = this.convertOldToNewFormat(currentSlide.time, currentSlide.slideType)
        }

        var event = this.generateBarrier(currentSlide)

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

    // create a skeleton to fill in the objects
    var skeleton = new Object()
    skeleton.metadata = metadata
    skeleton.choreographies = choreographies

    return skeleton
  },

  convertOldToNewFormat: function convertMSToNewFormat(ms, slideType) {
    var tmp = new Object

    tmp.time = 0.0
    tmp.position = [0.0, 0.0, this.calcZFromMS(ms)]
    tmp.initialized = true
    tmp.slideType = slideType == null ? 5 : slideType

    return tmp
  },

  startConversion: async function startConversion(filePath, callback) {

    var fileName = filePath.substr(filePath.lastIndexOf("\\") + 1)
    
    // check if Quest is connected
    quest = await this.questIsConnected()

    // support only dropping an .ogg file
    if (fileName.endsWith(".ogg")) {

      await this.deployToGame(filePath.substr(0, filePath.lastIndexOf("\\") + 1), fileName)

      callback({
        "result": true, "message": "The song was successfully imported.\nYou can find the files at:" +
          "\n" + (pc ? "- " + locationPC : "") +
          "\n" + (quest ? "- Your Quest" : "") +
          "\n" + ((!pc && !quest) ? outputDir : "")
      })

      return
    }

    // if we reach here, the dropped file was no .ogg, so we need to extract it
    tmpDir = process.env.LOCALAPPDATA + "\\Programs\\trip-sitter\\tmp_" + fileName.substr(0, fileName.length - ".synth".length) + "\\"

    try {
      var extract = require('extract-zip')
      // target directory is expected to be absolute
      await extract(filePath, { dir: tmpDir })
    } catch (exception) {
      callback({ "result": false, "message": "The provided file (" + filePath + ") is either not a valid .synth or corrupt. Error:\n" + exception.message })
    }

    var audioFile = fs.readdirSync(tmpDir).filter(function (file) { return file.match(".*\.ogg") })[0]

    var mm = require('music-metadata');

    var metadata = await mm.parseFile(tmpDir + audioFile)
    var duration = Math.floor(metadata.format?.duration)

    if (duration == undefined) {
      callback({ "result": false, "message": "The provided audio file (" + tmpDir + audioFile + ") seems to be corrupt." })
    }

    try {
      var data = fs.readFileSync(tmpDir + "beatmap.meta.bin", { encoding: 'utf8' }).toString().trim()

      // now, actually start the conversion
      var ats = this.convertSynthridersFile(data, duration);

      // write ATS to tmpdir for further processing
      fs.writeFileSync(tmpDir + ats.metadata.title + ".ats", JSON.stringify(ats, null, 2))

      await this.deployToGame(tmpDir, audioFile)
      await this.deployToGame(tmpDir, ats.metadata.title + ".ats")

      callback({
        "result": true, "message": "The song was successfully converted and imported.\nYou can find the files at:" +
          "\n" + (pc ? "- " + locationPC : "") +
          "\n" + (quest ? "- Your Quest" : "") +
          "\n" + ((!pc && !quest) ? outputDir : "")
      })

    } catch (exception) {

      callback({ "result": false, "message": exception.message })

    } finally {
      // delete tmp-directory
      fs.rmdirSync(tmpDir, { recursive: true })
    }
  },

  deployToGame: async function deployToGame(path, file) {

    // write  audio file and generated song into custom song location
    if (pc) {
      fs.copyFileSync(path + file, locationPC + file)
    }

    if (quest) {
      await this.copyToQuest(quest[0], quest[1], path + file)
    }

    if (!pc && !quest) {
      // create output folder of needed
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir)
      }

      fs.copyFileSync(path + file, outputDir + file)
      console.log("Written to local output directoy")
    }
  },

  questIsConnected: async function questIsConnected() {
    
    return new Promise((resolve, reject) => {
      var adb = require('adbkit')
      var client = adb.createClient( { bin: ".\\adb.exe" })

      client.listDevices().then(devices => {

        if (devices.length == 0) {
          console.log("No devices connected!")
          resolve(false)
        }

        for (var index in devices) {

          var id = devices[index].id

          client.getProperties(id).then(props => {
            var model = props["ro.product.model"]

            if (model == "Quest") {
              resolve([client, id])
            }
          })
        }
      })
    })
  },

  copyToQuest: async function copyToQuest(client, id, filePath) {

    return new Promise((resolve, reject) => {

      client.getProperties(id).then(props => {

        var model = props["ro.product.model"]

        if (model == "Quest") {

          client.syncService(id).then(sync => {

            var transfer = this.transferFileADB(sync, filePath)

            transfer.on('end', () => {
              resolve(true)
            })
            transfer.on('error', error => {
              console.error(error)
              resolve(false)
            })
          })
        }
      })
    })
  },

  transferFileADB: function transferFileADB(sync, filePath) {

    var fileName = filePath.substr(filePath.lastIndexOf("\\") + 1)

    return sync.pushFile(filePath, '/sdcard/Android/data/com.KinemotikStudios.AudioTripQuest/files/Songs/' + fileName)
  }
}

