/// Geohash encoding, precision 5 (roughly a 5km by 5km cell).
///
/// Location is deliberately coarse. A proof says "this happened in this area",
/// never "this happened at this doorstep". Anyone reading the chain sees the
/// cell and nothing more, which is what makes it safe to publish a report from
/// a place where being identified carries risk.
///
/// The cell is also what makes corroboration work: two people in the same cell
/// are reporting the same thing, and the attest screen finds them by cell.

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

const PRECISION = 5;

/// Encodes coordinates into a 5-character geohash.
export function encodeGeohash(latitude: number, longitude: number): string {
  const latRange = [-90, 90];
  const lonRange = [-180, 180];

  let hash = "";
  let bits = 0;
  let bitCount = 0;
  let isLongitudeTurn = true;

  while (hash.length < PRECISION) {
    const range = isLongitudeTurn ? lonRange : latRange;
    const value = isLongitudeTurn ? longitude : latitude;
    const middle = (range[0] + range[1]) / 2;

    if (value > middle) {
      bits = (bits << 1) + 1;
      range[0] = middle;
    } else {
      bits = bits << 1;
      range[1] = middle;
    }

    isLongitudeTurn = !isLongitudeTurn;
    bitCount += 1;

    // Base32 packs five bits per character.
    if (bitCount === 5) {
      hash += BASE32[bits];
      bits = 0;
      bitCount = 0;
    }
  }

  return hash;
}

/// Neighbouring cells matter because a 5km grid has hard edges: two people
/// standing beside the same well can land in different cells. The attest feed
/// widens its search by one cell so a border does not split a real event.
///
/// Approximated by nudging the coordinates rather than doing proper geohash
/// arithmetic, which is enough at this precision and far less code.
export function neighbouringGeohashes(
  latitude: number,
  longitude: number
): string[] {
  const LAT_STEP = 0.04; // about 4.5km
  const LON_STEP = 0.04;

  const cells = new Set<string>();

  for (const latOffset of [-LAT_STEP, 0, LAT_STEP]) {
    for (const lonOffset of [-LON_STEP, 0, LON_STEP]) {
      cells.add(encodeGeohash(latitude + latOffset, longitude + lonOffset));
    }
  }

  return Array.from(cells);
}
