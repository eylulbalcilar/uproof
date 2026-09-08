import { useRef, useState } from "react";
import { useSubmitProof } from "./hooks/useSubmitProof";

export default function App() {
  const { submit, drain, queue, isDraining, pendingCount } = useSubmitProof();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    try {
      await submit({
        taskId: "task-1",
        imageBlob: file,
        latitude: 59.3667,
        longitude: 17.8712,
        capturedAt: Math.floor(Date.now() / 1000),
      });
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100 p-6">
      <div className="mx-auto max-w-md space-y-6">
        <header>
          <h1 className="text-xl font-semibold">uproof</h1>
          <p className="text-sm text-neutral-400">Development harness</p>
        </header>

        <div className="space-y-3">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="w-full rounded-lg bg-neutral-100 px-4 py-3 font-medium text-neutral-900"
          >
            Capture proof
          </button>

          <button
            type="button"
            onClick={() => void drain()}
            disabled={isDraining || pendingCount === 0}
            className="w-full rounded-lg border border-neutral-700 px-4 py-3 text-sm disabled:opacity-40"
          >
            {isDraining ? "Sending..." : `Send queue (${pendingCount})`}
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-400">Queue</h2>

          {queue.length === 0 && (
            <p className="text-sm text-neutral-500">Nothing queued yet.</p>
          )}

          {queue.map((item) => (
            <article
              key={item.localId}
              className="rounded-lg border border-neutral-800 p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{item.status}</span>
                <span className="text-neutral-500">{item.bundle.geohash}</span>
              </div>

              {item.proofId !== undefined && (
                <p className="mt-1 text-neutral-400">
                  Proof #{item.proofId}
                </p>
              )}

              {item.txHash && (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `https://sepolia.basescan.org/tx/${item.txHash}`,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                  className="mt-1 text-xs text-blue-400 underline"
                >
                  View transaction
                </button>
              )}

              {item.lastError && (
                <p className="mt-1 text-xs text-red-400">{item.lastError}</p>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
