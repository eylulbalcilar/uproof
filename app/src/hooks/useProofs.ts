/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { readContract } from "@wagmi/core";
import { keccak256, stringToHex } from "viem";
import { wagmiConfig } from "../lib/wagmi";
import { proofRegistryConfig } from "../lib/contract";
import { getDevicePublicKey } from "../lib/deviceKey";
import { anchorAttestation } from "../lib/api";

/// Reads proofs and their corroborations straight from the chain.
///
/// There is no indexer and no database. The registry is the only source, which
/// means what this screen shows is what anyone else reading the chain would see.
/// That matters more than speed here: a report that only looks corroborated
/// inside this app would be worth nothing.

export type OnChainProof = {
  id: bigint;
  taskId: string;
  bundleHash: `0x${string}`;
  geohash: string;
  deviceKeyHash: `0x${string}`;
  submittedAt: bigint;
  attestCount: number;
  disputeCount: number;
};

export type OnChainAttestation = {
  deviceKeyHash: `0x${string}`;
  verifier: string;
  geohash: string;
  attestedAt: bigint;
};

export function useProofs(geohash: string) {
  const [proofs, setProofs] = useState<OnChainProof[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!geohash) return;

    setIsLoading(true);
    setError("");

    try {
      const ids = (await readContract(wagmiConfig, {
        ...proofRegistryConfig,
        functionName: "getProofsByGeohash",
        args: [geohash],
      })) as bigint[];

      if (ids.length === 0) {
        setProofs([]);
        return;
      }

      const records = (await readContract(wagmiConfig, {
        ...proofRegistryConfig,
        functionName: "getProofs",
        args: [ids],
      })) as OnChainProof[];

      // Newest first: the attest screen is about what just happened nearby.
      setProofs([...records].sort((a, b) => Number(b.id - a.id)));
    } catch (cause) {
      setError(String(cause));
    } finally {
      setIsLoading(false);
    }
  }, [geohash]);

  useEffect(() => {
    void load();
  }, [load]);

  return { proofs, isLoading, error, reload: load };
}

/// Corroborating or disputing a proof, from this device.
export function useAttest() {
  const [pendingId, setPendingId] = useState<bigint | null>(null);
  const [error, setError] = useState("");

  const act = useCallback(
    async (params: {
      proofId: bigint;
      geohash: string;
      kind: "attest" | "dispute";
      verifier?: string;
    }) => {
      setPendingId(params.proofId);
      setError("");

      try {
        const deviceKey = await getDevicePublicKey();

        await anchorAttestation({
          proofId: Number(params.proofId),
          deviceKeyHash: keccak256(stringToHex(deviceKey)),
          verifier: params.verifier ?? "",
          geohash: params.geohash,
          kind: params.kind,
        });
      } catch (cause) {
        setError(String(cause));
        throw cause;
      } finally {
        setPendingId(null);
      }
    },
    []
  );

  return { act, pendingId, error };
}
