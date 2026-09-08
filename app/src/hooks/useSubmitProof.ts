import { useCallback, useEffect, useRef, useState } from "react";
import { createProofBundle } from "../lib/proofBundle";
import { anchorProof } from "../lib/chainApi";
import {
  enqueue,
  getQueue,
  subscribeToQueue,
  updateItem,
  type QueuedProof,
} from "../lib/queue";

/// Capture-to-chain, with the network treated as optional.
///
/// Submitting always succeeds from the user's point of view: the bundle is
/// signed and queued, and the queue drains whenever a connection exists. A
/// person standing in a village with no signal should not have to understand
/// why their report failed, or remember to come back and retry it.

export function useSubmitProof() {
  const [queue, setQueue] = useState<QueuedProof[]>(getQueue);
  const [isDraining, setIsDraining] = useState(false);

  /// Guards against two drains running at once. A ref rather than state,
  /// because the guard has to be read and set within a single call.
  const draining = useRef(false);

  useEffect(() => subscribeToQueue(setQueue), []);

  /// Sends everything still waiting, oldest first, one at a time.
  ///
  /// Sequential rather than parallel: each anchor is a transaction from the
  /// same relayer account, and concurrent sends would collide on the nonce.
  const drain = useCallback(async () => {
    if (draining.current || !navigator.onLine) return;

    draining.current = true;
    setIsDraining(true);

    const waiting = getQueue().filter(
      (item) => item.status === "pending" || item.status === "failed"
    );

    for (const item of waiting) {
      updateItem(item.localId, { status: "sending" });

      try {
        const result = await anchorProof(item.bundle);
        updateItem(item.localId, {
          status: "sent",
          proofId: result.proofId,
          txHash: result.txHash,
        });
      } catch (error) {
        updateItem(item.localId, {
          status: "failed",
          attempts: item.attempts + 1,
          lastError: String(error),
        });
      }
    }

    draining.current = false;
    setIsDraining(false);
  }, []);

  // The connection usually returns while nobody is looking at the screen.
  useEffect(() => {
    window.addEventListener("online", drain);
    return () => window.removeEventListener("online", drain);
  }, [drain]);

  const submit = useCallback(
    async (params: {
      taskId: string;
      imageBlob: Blob;
      latitude: number;
      longitude: number;
      capturedAt: number;
    }) => {
      const bundle = await createProofBundle(params);
      const queued = enqueue(bundle);
      void drain();
      return queued;
    },
    [drain]
  );

  return {
    submit,
    drain,
    queue,
    isDraining,
    pendingCount: queue.filter(
      (item) => item.status === "pending" || item.status === "failed"
    ).length,
  };
}
