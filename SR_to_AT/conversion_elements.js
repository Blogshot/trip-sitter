module.exports = {

  generateCrouch: function generateCrouch(currentElement, json) {

    // modify element to have an additional "custom" slideType
    currentElement.slideType = 5

    // business as usual
    return this.generateBarrier(currentElement, json)
  },

  generateBarrier: function generateBarrier(currentElement, json) {

    var conversion_math = require('./conversion_math')

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
        event.position.z = -60
        break;
      case 3:
        event.hand = "center"
        // barrier center
        break;
      case 4:
        event.hand = "left diag"
        event.position.z = 60
        event.position.y = 0.2
        // barrier left diagonal                
        break
      case 5:
        // only possible via generateCrouch()
        event.hand = "crouch"
        event.position.y = 0.4 // a bit higher than shoulder level
        event.position.z = 0   // no rotation = horizontal
        break;
    }

    event.hasGuide = false
    event.bloggi = currentElement.position[2]
    event.beatDivision = 2
    event.broadcastEventID = 0

    var ms = conversion_math.calcMSFromZ(currentElement.position[2])
    event.time = conversion_math.calcBeatFromMillis(ms, json.bpm, json.offSetMS)

    event.gemType = "barrier"

    return event;
  },

  generateEvent: function generateEvent(currentElement, json) {

    var conversion_math = require('./conversion_math')

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

    var convertedCoords = conversion_math.calcXY(currentElement.Position[0].toFixed(2), currentElement.Position[1].toFixed(2))

    event.position.x = convertedCoords.x
    event.position.y = convertedCoords.y

    event.time = conversion_math.calcBeatFromMillis(conversion_math.calcMSFromZ(currentElement.Position[2]), json.bpm, json.offSetMS)

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

    var length_ms = conversion_math.calcMSFromZ(length)

    // for short ribbons (< 1 beat) we may need additional positions, so we increase beatdivision
    if (conversion_math.calcBeatFromMillis(length_ms, json.bpm, json.offSetMS).beat == 0) {
      event.beatDivision = 4
    }

    var length_beatDivision = (60000 / json.bpm).toFixed(0) / event.beatDivision

    var checkPoints = new Array()

    // go through the length of the ribbon and mark the spots (in ms) for new checkpoints
    while (length_ms > length_beatDivision) {

      length_ms -= length_beatDivision

      checkPoints.push(length_ms)
    }

    for (var checkpoint in checkPoints) {

      var currentCheckpoint = checkPoints[checkpoint]

      // find the nearest checkpoint in SynthRiders' format
      var goal = conversion_math.calcZFromMS(currentCheckpoint) + start

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

      var XY = conversion_math.calcXY(closest[0], closest[1], true)
      subPosition.x = XY.x * 2 / 3
      subPosition.y = XY.y * 2 / 3
      subPosition.z = "unused"

      event.subPositions.push(subPosition)
    }

    return event;
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

}