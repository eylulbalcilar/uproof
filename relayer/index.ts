import "dotenv/config";
import express from "express";
import cors from "cors";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { webcrypto } from "node:crypto";
import proofRegistryAbi from "../app/src/abi/ProofRegistry.json" with { type: "json" };

/// The relayer exists because field users cannot fund gas.
///
/// It is deliberately thin: it verifies that a bundle was signed by the device
/// it claims, then anchors it. It does not decide what is true, cannot alter a
/// bundle without breaking its signature, and holds no record of its own. The
/// chain is the database.

const PORT = Number(process.env.PORT ?? 3002);
const REGISTRY_ADDRESS = process.env.PROOF_REGISTRY_ADDRESS as Hex;
const RELAYER_KEY = process.env.PRIVATE_KEY as Hex;

/// Signature checking can be turned off while the client and the relayer are
/// still being brought into agreement. It must be on before this is shown to
/// anyone: without it the relayer anchors whatever it is handed.
const SKIP_SIGNATURE_CHECK = process.env.SKIP_SIGNATURE_CHECK === "true";

const account = privateKeyToAccount(RELAYER_KEY);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC_URL),
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

type ProofBundle = {
  taskId: string;
  imageHash: Hex;
  geohash: string;
  capturedAt: number;
  deviceKey: string;
  signature: string;
};

/// Rebuilds the exact bytes the device signed.
///
/// This must stay character-for-character identical to serialiseBundle in
/// app/src/lib/proofBundle.ts. If the two ever drift, every signature fails and
/// the failure looks like a key problem rather than a formatting one.
function serialiseBundle(bundle: Omit<ProofBundle, "signature">): Hex {
  const canonical = [
    bundle.taskId,
    bundle.imageHash,
    bundle.geohash,
    String(bundle.capturedAt),
    bundle.deviceKey,
  ].join("|");

  return keccak256(stringToHex(canonical));
}

function hexToBuffer(hex: string): ArrayBuffer {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const buffer = new ArrayBuffer(clean.length / 2);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i++) {
    view[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return buffer;
}

/// Verifies the device signature over the bundle.
///
/// Without this the relayer would be anchoring whatever it was handed, and the
/// signature in the bundle would prove nothing. With it, a bundle that reaches
/// the chain is one the device really produced, with the photo, place and time
/// it was produced with.
async function verifyDeviceSignature(bundle: ProofBundle): Promise<boolean> {
  try {
    const publicKey = await webcrypto.subtle.importKey(
      "raw",
      hexToBuffer(bundle.deviceKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );

    const { signature, ...unsigned } = bundle;

    return await webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      hexToBuffer(signature),
      hexToBuffer(serialiseBundle(unsigned))
    );
  } catch (error) {
    console.error("Signature verification threw:", error);
    return false;
  }
}

/// Anchors a signed proof bundle.
app.post("/api/proofs", async (req, res) => {
  const bundle = req.body as ProofBundle;

  if (!bundle?.deviceKey || !bundle?.signature) {
    return res.status(400).json({ error: "Malformed bundle" });
  }

  if (!SKIP_SIGNATURE_CHECK) {
    const isAuthentic = await verifyDeviceSignature(bundle);

    if (!isAuthentic) {
      console.error("Rejected bundle", {
        deviceKeyChars: bundle.deviceKey.length,
        signatureChars: bundle.signature.length,
        geohash: bundle.geohash,
      });
      return res
        .status(400)
        .json({ error: "Signature does not match device key" });
    }
  }

  try {
    const { signature, ...unsigned } = bundle;

    const hash = await walletClient.writeContract({
      address: REGISTRY_ADDRESS,
      abi: proofRegistryAbi,
      functionName: "submitProof",
      args: [
        bundle.taskId,
        serialiseBundle(unsigned),
        bundle.geohash,
        keccak256(stringToHex(bundle.deviceKey)),
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const proofCount = await publicClient.readContract({
      address: REGISTRY_ADDRESS,
      abi: proofRegistryAbi,
      functionName: "proofCount",
    });

    console.log(`Anchored proof #${proofCount} in ${receipt.transactionHash}`);

    res.json({
      proofId: Number(proofCount),
      txHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error("Anchor failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

/// Records a corroboration or a dispute.
app.post("/api/attestations", async (req, res) => {
  const { proofId, deviceKeyHash, verifier, geohash, kind } = req.body as {
    proofId: number;
    deviceKeyHash: Hex;
    verifier: string;
    geohash: string;
    kind: "attest" | "dispute";
  };

  if (kind !== "attest" && kind !== "dispute") {
    return res.status(400).json({ error: "Unknown attestation kind" });
  }

  try {
    const hash = await walletClient.writeContract({
      address: REGISTRY_ADDRESS,
      abi: proofRegistryAbi,
      functionName: kind,
      args: [BigInt(proofId), deviceKeyHash, verifier ?? "", geohash],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log(`Recorded ${kind} on proof #${proofId}`);

    res.json({ txHash: receipt.transactionHash });
  } catch (error) {
    console.error("Attestation failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    relayer: account.address,
    signatureCheck: !SKIP_SIGNATURE_CHECK,
  });
});

app.listen(PORT, () => {
  console.log(`Relayer listening on ${PORT}, signing as ${account.address}`);
  if (SKIP_SIGNATURE_CHECK) {
    console.warn("Signature verification is OFF. Turn it on before the demo.");
  }
});
