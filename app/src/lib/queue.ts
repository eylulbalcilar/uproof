import type { ProofBundle } from "./proofBundle";

/// Offline queue for signed proof bundles.
///
/// A proof is signed at capture time, on the device, and that signature does
/// not expire. So there is no reason for a submission to fail just because the
/// network did: the bundle is written to disk and sent whenever a connection
/// appears, hours or days later. The chain records when it was anchored, the
/// bundle records when it was captured, and the gap between the two is exactly
/// what working without connectivity looks like.
///
/// This is why the queue exists rather than a retry button. In the field the
/// user may never see the moment the connection returns.

const STORAGE_KEY = "uproof.queue.v1";

export type QueueStatus = "pending" | "sending" | "sent" | "failed";

export type QueuedProof = {
  /// Local identifier, distinct from the on-chain proof id, which does not
  /// exist until the bundle is anchored.
  localId: string;
  bundle: ProofBundle;
  status: QueueStatus;
  queuedAt: number;
  attempts: number;
  lastError?: string;
  /// Set once the relayer confirms the anchor.
  proofId?: number;
  txHash?: string;
};

type Listener = (items: QueuedProof[]) => void;

const listeners = new Set<Listener>();

function read(): QueuedProof[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedProof[]) : [];
  } catch {
    // A corrupt queue must not block new captures. Losing unsent proofs is bad;
    // refusing to accept new ones is worse.
    return [];
  }
}

function write(items: QueuedProof[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  listeners.forEach((listener) => listener(items));
}

export function getQueue(): QueuedProof[] {
  return read();
}

/// Subscribes to queue changes. Returns an unsubscribe function.
export function subscribeToQueue(listener: Listener): () => void {
  listeners.add(listener);
  listener(read());
  return () => listeners.delete(listener);
}

export function enqueue(bundle: ProofBundle): QueuedProof {
  const item: QueuedProof = {
    localId: crypto.randomUUID(),
    bundle,
    status: "pending",
    queuedAt: Math.floor(Date.now() / 1000),
    attempts: 0,
  };

  write([...read(), item]);
  return item;
}

export function updateItem(
  localId: string,
  changes: Partial<QueuedProof>
): void {
  write(
    read().map((item) =>
      item.localId === localId ? { ...item, ...changes } : item
    )
  );
}

/// Removes successfully anchored proofs. Failures are kept so the user can see
/// what did not go through.
export function clearSent(): void {
  write(read().filter((item) => item.status !== "sent"));
}

export function pendingCount(): number {
  return read().filter(
    (item) => item.status === "pending" || item.status === "failed"
  ).length;
}
