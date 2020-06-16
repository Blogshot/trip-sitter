module.exports = {

  reduce: function reduce(numerator, denominator) {

    // shamelessly stolen from https://stackoverflow.com/a/4652513
    var gcd = function gcd(a, b) {
      return b ? gcd(b, a % b) : a;
    };

    gcd = gcd(numerator, denominator);

    return [numerator / gcd, denominator / gcd];
  },

  calcBeatFromMillis: function calcBeatFromMillis(ms, bpm, offSetMS) {

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

  calcXY: function calcXY(x, y, OnlyOffset = false) {

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

  convertOldToNewFormat: function convertMSToNewFormat(ms, slideType) {
    var tmp = new Object

    tmp.time = 0.0
    tmp.position = [0.0, 0.0, this.calcZFromMS(ms)]
    tmp.initialized = true
    tmp.slideType = slideType == null ? 5 : slideType

    return tmp
  }
}

