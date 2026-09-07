/// Device identity. Generated in the browser on first use, kept in localStorage.
///
/// This is not a wallet. It holds no funds and signs no transactions. Its only
/// job is to make one device distinguishable from another, so the registry can
/// tell "five people reported this" apart from "one person reported it five times".
///
/// ECDSA over P-256 is used because WebCrypto supports it natively on every
/// mobile browser, with no library to load on a slow connection.

const STORAGE_KEY = "uproof.deviceKey.v1";

type StoredKey = {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
};

const ALGORITHM = {
  name: "ECDSA",
  namedCurve: "P-256",
} as const;

const SIGN_PARAMS = {
  name: "ECDSA",
  hash: "SHA-256",
} as const;

let cached: CryptoKeyPair | null = null;

/// Returns the device keypair, generating and persisting one on first call.
async function loadOrCreateKeyPair(): Promise<CryptoKeyPair> {
  if (cached) return cached;

  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored) {
    const { publicKeyJwk, privateKeyJwk } = JSON.parse(stored) as StoredKey;

    const [publicKey, privateKey] = await Promise.all([
      crypto.subtle.importKey("jwk", publicKeyJwk, ALGORITHM, true, ["verify"]),
      crypto.subtle.importKey("jwk", privateKeyJwk, ALGORITHM, true, ["sign"]),
    ]);

    cached = { publicKey, privateKey };
    return cached;
  }

  const keyPair = await crypto.subtle.generateKey(ALGORITHM, true, [
    "sign",
    "verify",
  ]);

  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", keyPair.publicKey),
    crypto.subtle.exportKey("jwk", keyPair.privateKey),
  ]);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ publicKeyJwk, privateKeyJwk })
  );

  cached = keyPair;
  return cached;
}

/// The public key as a hex string. This is what travels inside a proof bundle.
export async function getDevicePublicKey(): Promise<string> {
  const { publicKey } = await loadOrCreateKeyPair();
  const raw = await crypto.subtle.exportKey("raw", publicKey);
  return toHex(new Uint8Array(raw));
}

/// Signs arbitrary bytes with the device key. Works offline.
export async function signWithDeviceKey(data: Uint8Array): Promise<string> {
  const { privateKey } = await loadOrCreateKeyPair();
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
  const signature = await crypto.subtle.sign(SIGN_PARAMS, privateKey, buffer);
  return toHex(new Uint8Array(signature));
}

/// Wipes the device identity. Useful for testing two "people" on one laptop.
export function resetDeviceKey(): void {
  localStorage.removeItem(STORAGE_KEY);
  cached = null;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
