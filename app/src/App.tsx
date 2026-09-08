import { useRef, useState } from "react";
import { useSubmitProof } from "./hooks/useSubmitProof";
import { useProofs, useAttest } from "./hooks/useProofs";
import { ProofCard } from "./components/ProofCard";
import { encodeGeohash } from "./lib/geohash";

/// Development harness for the capture and corroboration flow.
///
/// Location is fixed here rather than read from the device, so the flow can be
/// exercised on a laptop. The real screen takes coordinates from the camera
/// component at the moment of capture.
const DEMO_LOCATION = { latitude: 59.3667, longitude: 17.8712 };
const DEMO_TASK = "Water pump installation, Kibera";

/// Population density of the reporting area, 1 for dense, 0.4 for sparse.
/// Comes from task seed data in the real flow.
const DEMO_DENSITY = 0.6;

const DEMO_GEOHASH = encodeGeohash(
  DEMO_LOCATION.latitude,
  DEMO_LOCATION.longitude
);

type Tab = "capture" | "attest";

export default function App() {
  const [tab, setTab] = useState<Tab>("capture");

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-md p-5">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">uproof</h1>
          <p className="text-sm text-neutral-400">
            Cell {DEMO_GEOHASH}
          </p>
        </header>

        <nav className="mb-6 flex gap-1 rounded-lg bg-neutral-900 p-1">
          <TabButton
            label="Capture"
            isActive={tab === "capture"}
            onClick={() => setTab("capture")}
          />
          <TabButton
            label="Corroborate"
            isActive={tab === "attest"}
            onClick={() => setTab("attest")}
          />
        </nav>

        {tab === "capture" ? <CaptureTab /> : <AttestTab />}
      </div>
    </main>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive}
      className={`flex-1 rounded-md px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-neutral-100 font-medium text-neutral-900"
          : "text-neutral-400"
      }`}
    >
      {label}
    </button>
  );
}

function CaptureTab() {
  const { submit, drain, queue, isDraining, pendingCount } = useSubmitProof();
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    await submit({
      taskId: DEMO_TASK,
      imageBlob: file,
      latitude: DEMO_LOCATION.latitude,
      longitude: DEMO_LOCATION.longitude,
      capturedAt: Math.floor(Date.now() / 1000),
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-neutral-800 p-4">
        <h2 className="text-sm font-medium">{DEMO_TASK}</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Photograph the completed work. Your location is recorded as a 5km area,
          never an exact point.
        </p>
      </section>

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
        className="w-full rounded-lg bg-neutral-100 px-4 py-3.5 font-medium text-neutral-900"
      >
        Capture proof
      </button>

      {pendingCount > 0 && (
        <button
          type="button"
          onClick={() => void drain()}
          disabled={isDraining}
          className="w-full rounded-lg border border-neutral-700 px-4 py-3 text-sm disabled:opacity-40"
        >
          {isDraining ? "Sending..." : `Send ${pendingCount} waiting`}
        </button>
      )}

      {queue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-400">Your reports</h2>

          {queue.map((item) => (
            <article
              key={item.localId}
              className="rounded-lg border border-neutral-800 p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{item.status}</span>
                <span className="text-xs text-neutral-500">
                  {item.bundle.geohash}
                </span>
              </div>

              {item.status === "sent" && item.txHash && (
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
                  View on chain
                </button>
              )}

              {item.status === "pending" && (
                <p className="mt-1 text-xs text-neutral-500">
                  Signed and stored. Will send when a connection returns.
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function AttestTab() {
  const { proofs, isLoading, error, reload } = useProofs(DEMO_GEOHASH);
  const { act, pendingId } = useAttest();

  async function handleAct(proofId: bigint, kind: "attest" | "dispute") {
    try {
      await act({ proofId, geohash: DEMO_GEOHASH, kind });
      await reload();
    } catch {
      // The error is surfaced by useAttest; the list stays as it was.
    }
  }

  if (isLoading && proofs.length === 0) {
    return <p className="text-sm text-neutral-500">Reading the chain...</p>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-400">{error}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-lg border border-neutral-700 px-3 py-2 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (proofs.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Nothing reported in this area yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Reports from your area. Confirm what you have seen yourself.
      </p>

      {proofs.map((proof) => (
        <ProofCard
          key={String(proof.id)}
          proof={proof}
          density={DEMO_DENSITY}
          isActing={pendingId === proof.id}
          onAttest={() => void handleAct(proof.id, "attest")}
          onDispute={() => void handleAct(proof.id, "dispute")}
        />
      ))}
    </div>
  );
}
