import { keccak256, toBytes, stringToHex } from "viem";
import { getDevicePublicKey, signWithDeviceKey } from "./deviceKey";
import { encodeGeohash } from "./geohash";

/// Builds and signs the packet that a proof consists of.
///
/// The signature is made at capture time, on the device, before anything is
/// sent anywhere. This is what separates a proof from a claim: the backend can
/// relay it, delay it or batch it, but it cannot alter the photo, the place or
/// the moment without the signature failing.
///
/// The AI photo check never touches this. It advises the user before capture
/// and adds nothing to the bundle. A bundle that an AI could edit would prove
/// nothing about the world, only about the AI.

export type ProofBundle = {
  taskId: string;
  /// keccak256 of the raw photo bytes.
  imageHash: `0x${string}`;
  /// 5-character cell, never exact coordinates.
  geohash: string;
  /// Unix seconds at the moment the shutter fired.
  capturedAt: number;
  /// Hex-encoded P-256 public key of the capturing device.
  deviceKey: string;
  /// Hex-encoded signature over the bundle hash.
  signature: string;
};

type UnsignedBundle = Omit<ProofBundle, "signature">;

/// What the relayer needs to anchor the bundle on chain.
export type AnchorPayload = {
  taskId: string;
  bundleHash: `0x${string}`;
  geohash: string;
  deviceKeyHash: `0x${string}`;
};

/// Hashes the photo without ever uploading it. The bytes stay on the device;
/// only this 32-byte digest leaves it.
export async function hashImage(imageBlob: Blob): Promise<`0x${string}`> {
  const buffer = await imageBlob.arrayBuffer();
  return keccak256(new Uint8Array(buffer));
}

/// Canonical serialisation of a bundle, used for both signing and anchoring.
///
/// Field order is fixed and the format is flat: two devices that sign the same
/// facts must produce the same bytes, or verification becomes a matter of
/// whose JSON serialiser ran.
function serialiseBundle(bundle: UnsignedBundle): `0x${string}` {
  const canonical = [
    bundle.taskId,
    bundle.imageHash,
    bundle.geohash,
    String(bundle.capturedAt),
    bundle.deviceKey,
  ].join("|");

  return keccak256(stringToHex(canonical));
}

/// Creates a signed bundle from a captured photo. Runs entirely offline.
export async function createProofBundle(params: {
  taskId: string;
  imageBlob: Blob;
  latitude: number;
  longitude: number;
  capturedAt: number;
}): Promise<ProofBundle> {
  const [imageHash, deviceKey] = await Promise.all([
    hashImage(params.imageBlob),
    getDevicePublicKey(),
  ]);

  const unsigned: UnsignedBundle = {
    taskId: params.taskId,
    imageHash,
    geohash: encodeGeohash(params.latitude, params.longitude),
    capturedAt: params.capturedAt,
    deviceKey,
  };

  const bundleHash = serialiseBundle(unsigned);
  const signature = await signWithDeviceKey(toBytes(bundleHash));

  return { ...unsigned, signature };
}

/// Reduces a signed bundle to the four values the contract stores.
///
/// The device key is hashed rather than stored raw: the chain needs to tell
/// devices apart, not to be able to identify them.
export function toAnchorPayload(bundle: ProofBundle): AnchorPayload {
  return {
    taskId: bundle.taskId,
    bundleHash: serialiseBundle(bundle),
    geohash: bundle.geohash,
    deviceKeyHash: keccak256(stringToHex(bundle.deviceKey)),
  };
}

/// Recomputes the hash of a bundle so a verifier can check it independently.
export function verifyBundleHash(
  bundle: ProofBundle,
  claimedHash: `0x${string}`
): boolean {
  return serialiseBundle(bundle) === claimedHash;
}
