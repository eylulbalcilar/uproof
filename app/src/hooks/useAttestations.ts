
import { useCallback, useEffect, useState } from "react";
import { readContract } from "@wagmi/core";
import { wagmiConfig } from "../lib/wagmi";
import { proofRegistryConfig } from "../lib/contract";
import type { OnChainAttestation } from "./useProofs";

/// Reads the corroboration records for one proof.
///
/// Full records rather than the counter the contract already keeps, because the
/// score depends on who acted, when, and under which verifier. The counter says
/// how many; these say whether they were plausibly independent.
export function useAttestations(proofId: bigint | null) {
  const [attestations, setAttestations] = useState<OnChainAttestation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (proofId === null) {
      setAttestations([]);
      return;
    }

    setIsLoading(true);

    try {
      const records = (await readContract(wagmiConfig, {
        ...proofRegistryConfig,
        functionName: "getAttestations",
        args: [proofId],
      })) as OnChainAttestation[];

      setAttestations(records);
    } catch {
      setAttestations([]);
    } finally {
      setIsLoading(false);
    }
  }, [proofId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return { attestations, isLoading, reload: load };
}
