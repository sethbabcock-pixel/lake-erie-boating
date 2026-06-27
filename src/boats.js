// Boat types and the wind/wave comfort limits we recommend for each.
//
// These are general comfort/safety guidance for an average operator on Lake
// Erie's short, steep chop — not hard rules. The account page lets a boater
// pick a type to start from, then override with their own numbers. Whatever
// they land on is written to prefs.maxWaveFt / prefs.maxWindKt, which the main
// GO / CAUTION call already reads.
export const BOAT_TYPES = [
  { id: "kayak", label: "Kayak / canoe / paddle", maxWaveFt: 1, maxWindKt: 10 },
  { id: "pwc", label: "Personal watercraft (Jet Ski)", maxWaveFt: 2, maxWindKt: 15 },
  { id: "dinghy", label: "Small fishing boat / dinghy (under 16 ft)", maxWaveFt: 2, maxWindKt: 12 },
  { id: "pontoon", label: "Pontoon", maxWaveFt: 2, maxWindKt: 15 },
  { id: "bowrider", label: "Bowrider / runabout (16–22 ft)", maxWaveFt: 3, maxWindKt: 18 },
  { id: "deckboat", label: "Deck boat", maxWaveFt: 3, maxWindKt: 18 },
  { id: "centerconsole", label: "Center console (23–28 ft)", maxWaveFt: 4, maxWindKt: 22 },
  { id: "cruiser", label: "Cabin cruiser (26–35 ft)", maxWaveFt: 5, maxWindKt: 25 },
  { id: "sailboat", label: "Sailboat / keelboat", maxWaveFt: 5, maxWindKt: 28 },
  { id: "offshore", label: "Offshore / large (35 ft and up)", maxWaveFt: 6, maxWindKt: 30 },
];

export const boatById = (id) => BOAT_TYPES.find((b) => b.id === id) || null;

// The limits in effect, given a prefs object: a custom override wins, otherwise
// the recommendation for the chosen boat type (or nulls = "any").
export function effectiveLimits(prefs = {}) {
  if (prefs.comfortMode === "custom") {
    return { maxWaveFt: prefs.maxWaveFt ?? null, maxWindKt: prefs.maxWindKt ?? null };
  }
  const b = boatById(prefs.boatType);
  return b ? { maxWaveFt: b.maxWaveFt, maxWindKt: b.maxWindKt } : { maxWaveFt: null, maxWindKt: null };
}
