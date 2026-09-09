# UProof

Built at FIRSTBLOCK-ATHON 2026, on the UNICEF problem statement.

An extension to U-Report that makes field work verifiable by the people
who fund it.

## The problem

When UNICEF builds a latrine, runs a vaccination drive or trains a
teacher, the organisation that received the money writes the report.
Donors and auditors have no way to check it, and sending an inspector
to every village costs more than the work itself.

The evidence exists. It is just locked inside systems that only UNICEF
can read, which means it proves nothing to anyone outside.

## What UProof does

UProof splits the evidence in two.

The photograph, the exact location and everything else that could
identify a person stays inside UNICEF's own systems, under UNICEF's
access controls, where it belongs.

What goes on a public blockchain is a stripped record of the same
event: a fingerprint of the photo, a 5km area, the moment it was
captured, and a key that identifies the device rather than the person.

A donor can then verify that the work was reported, when it was
reported, and that the photograph UNICEF holds has not been altered
since. Without an account, without UNICEF's permission, and without a
single personal detail ever becoming public.

## What the reporter does

Opens the app and photographs the completed work. That is the entire
interaction.

Location and time come from the camera, not from a form. The photo is
hashed on the device. The location is reduced to a 5km cell. The whole
package is signed with a key the browser generated on first use, and
anchored on chain within seconds.

No wallet, no account, no gas, no blockchain knowledge. If there is no
signal, the signed package waits on the device and goes out when a
connection returns, which is why the chain records both when the photo
was taken and when it arrived.

## Corroboration

A single report is one person's word. Others in the same area can
confirm it, each from their own device, and the chain enforces that a
device cannot confirm its own report or act on the same report twice.

Confirmation from a device backed by a verified identity carries more
weight than an anonymous one. Identity raises confidence; it is never
required. In the places UNICEF works, an identity provider often does
not exist, and a system that demands one fails exactly where it is
needed most.

## What the chain stores

`taskId`, `regionName`, `locationArea` (5-character geohash),
`photoFingerprint`, `reporterDevice`, `capturedAt`, `recordedAt`.

No photo. No name. No exact coordinates. The registry is the only
source of truth for proofs and confirmations; there is no database
behind it.

## Design decisions

**Photos stay off chain.** A permanent public ledger is the wrong place
for a child's face. The fingerprint proves the photograph was never
altered, without making it public.

**Scoring is off chain.** Weights, collusion penalties and thresholds
are policy, and policy changes faster than a deployed contract should.
The contract stores facts; clients decide what they add up to.

**Density-scaled thresholds.** A fixed threshold punishes sparse areas.
In a village of forty people, five witnesses may not exist.

**Nothing is deleted.** A contested report gains a dispute counter.
Removing it would make the registry as deniable as the paper reports it
replaces.

## Deployment

**ProofRegistry** on Base Sepolia:
[`0xe9e4B82FA1b16838420603C0c74f3643408DC467`](https://sepolia.basescan.org/address/0xe9e4B82FA1b16838420603C0c74f3643408DC467)

Source verified. Every record is readable without an account.

## Structure

- `contracts/` Solidity, Foundry
- `app/` Vite + React + TypeScript frontend
- `relayer/` Express service that verifies device signatures and pays gas
