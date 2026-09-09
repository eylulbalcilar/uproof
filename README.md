# uproof

Corroboration-based proof of field work for humanitarian programs.

Today the organisation that receives the money writes its own report,
and nobody can check it. Sending an inspector to every village is not
affordable. uproof replaces self-reporting with something anyone can
verify: people in the community submit the proof themselves, and other
people confirm it.

Trust does not come from who reported. It comes from how many
independent people reported the same thing.

Built at FIRSTBLOCK-ATHON 2026, on the UNICEF problem statement.

## How it works

1. A QR code opens the app. No install, no account, no wallet.
2. The browser generates a keypair. It identifies the device, not the person.
3. The photo is hashed on the device. The photo itself never leaves it.
4. Location becomes a 5km cell. Exact coordinates are never recorded.
5. The bundle is signed at the moment of capture, offline if needed.
6. A backend relayer pays gas and anchors it on Base Sepolia.
7. Other people confirm or dispute it. Each confirmation raises the score.

## What the chain stores

`taskId`, `regionName`, `locationArea` (5-character geohash),
`photoFingerprint`, `reporterDevice`, `capturedAt`, `recordedAt`.

No photo. No name. No exact location.

The chain is the only source of truth for proofs and confirmations.
There is no separate database on the blockchain side.

## Design decisions

**Identity is a multiplier, not a gate.** Anyone can report and anyone
can confirm, without an account. A confirmation backed by a verified
identity counts more. Requiring identity would break the system in
exactly the places it is meant to serve, where no verifier exists.

**Two rules enforced on chain.** A device cannot confirm its own report,
and one device gets one action per report.

**Scoring is off-chain.** Weights, collusion penalties and thresholds are
policy, and policy changes faster than a deployed contract should. The
contract stores facts; clients derive confidence.

**Density-scaled thresholds.** A fixed threshold punishes sparse areas.
In a village of forty people, five witnesses may not exist.

**Nothing is deleted.** A contested proof gains a dispute counter.
Removing it would make the registry as deniable as the paper reports
it replaces.

**Photos stay off chain.** A permanent public ledger is the wrong place
for a child's face. The fingerprint proves the photo was not altered,
without making it public.

## Deployment

**ProofRegistry** on Base Sepolia:
[`0xe9e4B82FA1b16838420603C0c74f3643408DC467`](https://sepolia.basescan.org/address/0xe9e4B82FA1b16838420603C0c74f3643408DC467)

Source verified. Every proof is readable without an account.

## Structure

- `contracts/` Solidity, Foundry
- `app/` Vite + React + TypeScript frontend
- `relayer/` Express service that verifies device signatures and pays gas

## Not in scope for the hackathon

Encrypted IPFS storage, graph-based collusion analysis, ZK attribute
proofs, passkey-backed device keys, real U-Report integration, mainnet
deployment.
