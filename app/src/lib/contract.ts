import proofRegistryAbi from "../abi/ProofRegistry.json";

export const PROOF_REGISTRY_ADDRESS = import.meta.env
  .VITE_PROOF_REGISTRY_ADDRESS as `0x${string}`;

export const proofRegistryConfig = {
  address: PROOF_REGISTRY_ADDRESS,
  abi: proofRegistryAbi,
} as const;
