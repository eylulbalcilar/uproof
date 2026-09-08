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


/// Turns coordinates into a readable region name for the chain record.
///
/// The chain stores this alongside the geohash so that someone reading the raw
/// record sees "Stockholm, Sweden" rather than only "u6sce". It is deliberately
/// coarse: a country and a broad area, never a district or a street. A reader
/// should be able to place the report on a map of the world, not on a map of
/// the neighbourhood.
export function describeRegion(latitude: number, longitude: number): string {
  const regions: Array<{
    name: string;
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  }> = [
    { name: "Stockholm, Sweden", minLat: 58.9, maxLat: 60.2, minLon: 17.0, maxLon: 19.0 },
    { name: "Sweden", minLat: 55.0, maxLat: 69.1, minLon: 10.9, maxLon: 24.2 },
    { name: "Nairobi County, Kenya", minLat: -1.5, maxLat: -1.1, minLon: 36.6, maxLon: 37.1 },
    { name: "Kenya", minLat: -4.7, maxLat: 5.0, minLon: 33.9, maxLon: 41.9 },
    { name: "Jordan", minLat: 29.2, maxLat: 33.4, minLon: 34.9, maxLon: 39.3 },
    { name: "Bangladesh", minLat: 20.7, maxLat: 26.6, minLon: 88.0, maxLon: 92.7 },
  ];

  const match = regions.find(
    (region) =>
      latitude >= region.minLat &&
      latitude <= region.maxLat &&
      longitude >= region.minLon &&
      longitude <= region.maxLon
  );

  return match?.name ?? "Unspecified region";
}
