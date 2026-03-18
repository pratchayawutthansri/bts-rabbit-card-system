/**
 * BTS Fare Calculation Utility
 * 
 * Shared module used by both fare.js and trips.js
 * to ensure consistent fare calculation across the entire app.
 */

// BTS 2024 fare table (station count → baht)
const BTS_FARE_TABLE = {
  0: 0, 1: 17, 2: 17, 3: 25, 4: 28, 5: 32, 6: 35, 7: 37,
  8: 40, 9: 42, 10: 44, 11: 47, 12: 50, 13: 54, 14: 59
};

// Extension stations that incur a ฿15 surcharge
const EXTENSION_STATIONS = [
  'E15','E16','E17','E18','E19','E20','E21','E22','E23',
  'N11','N12','N13','N14','N15','N16','N17','N18','N19','N20','N21','N22','N23','N24'
];

// Interchange constants
const SIAM_ORDER_SUKHUMVIT = 24;  // Siam (CEN) = station_order 24 on Sukhumvit
const SIAM_ADJACENT_SILOM = 1;    // W1 (National Stadium) = station_order 1 on Silom, adjacent to Siam

/**
 * Calculate the number of stations between two stations,
 * including interchange if they are on different lines.
 * 
 * @param {Object} fromStation - Station object with line_id, station_order
 * @param {Object} toStation   - Station object with line_id, station_order
 * @returns {number} stationCount
 */
function calculateStationCount(fromStation, toStation) {
  if (fromStation.line_id === toStation.line_id) {
    return Math.abs(fromStation.station_order - toStation.station_order);
  }

  // Different lines — interchange required
  let fromToSiam, siamToTo;

  if (fromStation.line_id === 'sukhumvit' && toStation.line_id === 'silom') {
    fromToSiam = Math.abs(fromStation.station_order - SIAM_ORDER_SUKHUMVIT);
    siamToTo = Math.abs(toStation.station_order - SIAM_ADJACENT_SILOM);
  } else if (fromStation.line_id === 'silom' && toStation.line_id === 'sukhumvit') {
    fromToSiam = Math.abs(fromStation.station_order - SIAM_ADJACENT_SILOM);
    siamToTo = Math.abs(toStation.station_order - SIAM_ORDER_SUKHUMVIT);
  } else {
    // Gold line — interchanges at Krung Thon Buri (S7, order 8 on Silom)
    if (fromStation.line_id === 'gold') {
      fromToSiam = fromStation.station_order + 8;
      siamToTo = Math.abs(toStation.station_order - (toStation.line_id === 'sukhumvit' ? SIAM_ORDER_SUKHUMVIT : SIAM_ADJACENT_SILOM));
    } else {
      fromToSiam = Math.abs(fromStation.station_order - (fromStation.line_id === 'sukhumvit' ? SIAM_ORDER_SUKHUMVIT : SIAM_ADJACENT_SILOM));
      siamToTo = toStation.station_order + 8;
    }
  }

  return fromToSiam + siamToTo + 1; // +1 for interchange
}

/**
 * Calculate the fare between two stations.
 * 
 * @param {Object} fromStation       - Station object
 * @param {Object} toStation         - Station object
 * @param {string} fromStationCode   - e.g. 'E15'
 * @param {string} toStationCode     - e.g. 'S12'
 * @returns {{ fare: number, stationCount: number, extensionSurcharge: number }}
 */
function calculateFare(fromStation, toStation, fromStationCode, toStationCode) {
  const stationCount = calculateStationCount(fromStation, toStation);
  const fareKey = Math.min(stationCount, 14);
  let baseFare = BTS_FARE_TABLE[fareKey] || 59;

  let extensionSurcharge = 0;
  if (EXTENSION_STATIONS.includes(fromStationCode) || EXTENSION_STATIONS.includes(toStationCode)) {
    extensionSurcharge = 15;
  }

  return {
    fare: baseFare + extensionSurcharge,
    stationCount,
    extensionSurcharge
  };
}

/**
 * Estimate travel time in minutes based on station count.
 * Average ~2 minutes per station.
 * 
 * @param {number} stationCount
 * @returns {number} minutes
 */
function estimateTravelTime(stationCount) {
  return stationCount * 2;
}

module.exports = {
  BTS_FARE_TABLE,
  EXTENSION_STATIONS,
  SIAM_ORDER_SUKHUMVIT,
  SIAM_ADJACENT_SILOM,
  calculateStationCount,
  calculateFare,
  estimateTravelTime
};
