import type { OnChainAttestation } from "../hooks/useProofs";

/// Turns corroboration records into a confidence score.
///
/// This lives off-chain on purpose. The weights below are a policy judgement,
/// not a fact, and policy has to be arguable: a country office may decide that
/// two witnesses are enough in a village of two hundred people, and five are
/// needed in a city. The chain stores who said what and when. What that adds up
/// to is a separate question, answered here, and answerable differently by
/// anyone reading the same records.

/// A corroboration from an unverified device.
const ANONYMOUS_WEIGHT = 1;

/// A corroboration from a device an identity provider vouched for.
///
/// Three rather than ten: a verified person can still lie, so identity raises
/// confidence without settling it. Making it decisive would rebuild the very
/// gate this system exists to avoid.
const VERIFIED_WEIGHT = 3;

/// Corroborations arriving within a minute of each other are halved.
///
/// Independent witnesses do not act in lockstep. A burst is more likely to be
/// one person with several devices, or a group being coached, than five people
/// who happened to look at the same thing at the same second.
const BURST_WINDOW_SECONDS = 60;

/// Corroborations from the exact same cell as the submitter are halved too, on
/// the same reasoning: distance between witnesses is weak evidence that they
/// are actually different people.
const SAME_CELL_PENALTY = 0.5;

export type ConfidenceStatus = "awaiting" | "corroborated" | "disputed";

export type Confidence = {
  score: number;
  threshold: number;
  status: ConfidenceStatus;
  verifiedCount: number;
  anonymousCount: number;
};

/// How many independent corroborations a cell needs.
///
/// Scaled by population density, because a fixed threshold punishes exactly the
/// places this is meant to serve: in a village of forty people, five witnesses
/// may not exist, and demanding them means the report never clears while an
/// identical report from a city does.
export function thresholdForDensity(density: number): number {
  const BASE_THRESHOLD = 5;
  const clamped = Math.min(Math.max(density, 0.4), 1);
  return BASE_THRESHOLD * clamped;
}

export function calculateConfidence(params: {
  attestations: OnChainAttestation[];
  disputeCount: number;
  submitterGeohash: string;
  density: number;
}): Confidence {
  const { attestations, disputeCount, submitterGeohash, density } = params;

  const ordered = [...attestations].sort(
    (a, b) => Number(a.attestedAt) - Number(b.attestedAt)
  );

  let score = 0;
  let verifiedCount = 0;
  let anonymousCount = 0;
  let previousAt: number | null = null;

  for (const attestation of ordered) {
    const isVerified = attestation.verifier.length > 0;
    let weight = isVerified ? VERIFIED_WEIGHT : ANONYMOUS_WEIGHT;

    if (isVerified) verifiedCount += 1;
    else anonymousCount += 1;

    const attestedAt = Number(attestation.attestedAt);

    if (previousAt !== null && attestedAt - previousAt < BURST_WINDOW_SECONDS) {
      weight *= SAME_CELL_PENALTY;
    }

    if (attestation.geohash === submitterGeohash) {
      weight *= SAME_CELL_PENALTY;
    }

    score += weight;
    previousAt = attestedAt;
  }

  const threshold = thresholdForDensity(density);

  /// Disputes do not subtract from the score. A contested proof is not a weaker
  /// proof, it is a proof somebody disagrees with, and that is a different thing
  /// to show the reader.
  const status: ConfidenceStatus =
    disputeCount > 0
      ? "disputed"
      : score >= threshold
        ? "corroborated"
        : "awaiting";

  return { score, threshold, status, verifiedCount, anonymousCount };
}
