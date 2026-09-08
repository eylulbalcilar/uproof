import type { ProofBundle } from "./proofBundle";

/// Every call to the backend lives here.
///
/// Two rules hold throughout: a failure never blocks the user, and a failure
/// never silently changes what a proof says. The photo check can be down and
/// capture still works. Identity verification can be down and the corroboration
/// still counts, just at anonymous weight.

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3002";

export type PhotoCheck = {
  ok: boolean;
  message: string;
};

export type Verification = {
  verified: boolean;
  /// Written to the chain as-is. Empty string means anonymous.
  verifier: string;
};

export type AnchorResult = {
  proofId: number;
  txHash: string;
};

/// Asks the model whether the photo plausibly shows the task.
///
/// Advisory only. The user can submit against a negative answer, and the result
/// never enters the signed bundle. An AI that could veto a report would decide
/// what counts as true in places where nobody else is watching.
export async function checkPhoto(
  imageBlob: Blob,
  taskDescription: string
): Promise<PhotoCheck> {
  try {
    const form = new FormData();
    form.append("image", imageBlob);
    form.append("taskDescription", taskDescription);

    const response = await fetch(`${BASE_URL}/api/check-photo`, {
      method: "POST",
      body: form,
    });

    if (!response.ok) throw new Error(String(response.status));

    return (await response.json()) as PhotoCheck;
  } catch {
    return { ok: true, message: "" };
  }
}

/// Asks the identity provider whether this device belongs to a verified person.
///
/// Falls back to anonymous rather than failing. Identity raises the weight of a
/// corroboration; its absence must never remove the ability to give one.
export async function verifyDevice(deviceKey: string): Promise<Verification> {
  try {
    const response = await fetch(`${BASE_URL}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceKey }),
    });

    if (!response.ok) throw new Error(String(response.status));

    return (await response.json()) as Verification;
  } catch {
    return { verified: false, verifier: "" };
  }
}

/// Hands a signed bundle to the relayer, which pays gas and writes it on chain.
///
/// The whole bundle travels, not just the four values the contract stores: the
/// relayer needs the signature and the fields it covers in order to verify that
/// the device really produced this, before spending gas on it.
///
/// This one is allowed to throw: a failed anchor means the proof is not yet
/// recorded, and the queue needs to know that so it can retry.
export async function anchorProof(bundle: ProofBundle): Promise<AnchorResult> {
  const response = await fetch(`${BASE_URL}/api/proofs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bundle),
  });

  if (!response.ok) {
    throw new Error(`Anchor failed with status ${response.status}`);
  }

  return (await response.json()) as AnchorResult;
}

/// Submits a corroboration or a dispute for an existing proof.
export async function anchorAttestation(params: {
  proofId: number;
  deviceKeyHash: `0x${string}`;
  verifier: string;
  geohash: string;
  kind: "attest" | "dispute";
}): Promise<{ txHash: string }> {
  const response = await fetch(`${BASE_URL}/api/attestations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Attestation failed with status ${response.status}`);
  }

  return (await response.json()) as { txHash: string };
}
