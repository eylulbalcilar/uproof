import { useAttestations } from "../hooks/useAttestations";
import { calculateConfidence } from "../lib/confidence";
import type { OnChainProof } from "../hooks/useProofs";

/// One reported event, with what the chain says about it.
///
/// The score is shown alongside its parts, not on its own. A number that cannot
/// be taken apart is a verdict, and this system is not in the business of
/// issuing verdicts: it shows how many people said the same thing, and lets the
/// reader decide what that is worth.

type Props = {
  proof: OnChainProof;
  density: number;
  isActing: boolean;
  onAttest: () => void;
  onDispute: () => void;
};

const STATUS_STYLE = {
  awaiting: "text-amber-400 border-amber-900 bg-amber-950/40",
  corroborated: "text-emerald-400 border-emerald-900 bg-emerald-950/40",
  disputed: "text-rose-400 border-rose-900 bg-rose-950/40",
} as const;

const STATUS_LABEL = {
  awaiting: "Awaiting corroboration",
  corroborated: "Corroborated",
  disputed: "Disputed",
} as const;

export function ProofCard({
  proof,
  density,
  isActing,
  onAttest,
  onDispute,
}: Props) {
  const { attestations } = useAttestations(proof.id);

  const confidence = calculateConfidence({
    attestations,
    disputeCount: proof.disputeCount,
    submitterGeohash: proof.geohash,
    density,
  });

  const percentage = Math.min(
    100,
    Math.round((confidence.score / confidence.threshold) * 100)
  );

  return (
    <article className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{proof.taskId}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Cell {proof.geohash} &middot;{" "}
            {new Date(Number(proof.submittedAt) * 1000).toLocaleString()}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${STATUS_STYLE[confidence.status]}`}
        >
          {STATUS_LABEL[confidence.status]}
        </span>
      </header>

      <div className="mt-4">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-neutral-800"
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Confidence toward threshold"
        >
          <div
            className="h-full rounded-full bg-neutral-100 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-neutral-400">
          Score {confidence.score.toFixed(1)} of{" "}
          {confidence.threshold.toFixed(1)} needed here
        </p>

        <p className="mt-1 text-xs text-neutral-500">
          {confidence.anonymousCount} anonymous
          {confidence.verifiedCount > 0 && (
            <>, {confidence.verifiedCount} verified via Neuro</>
          )}
          {proof.disputeCount > 0 && <>, {proof.disputeCount} disputed</>}
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onAttest}
          disabled={isActing}
          className="flex-1 rounded-lg bg-neutral-100 px-3 py-2.5 text-sm font-medium text-neutral-900 disabled:opacity-40"
        >
          {isActing ? "Recording..." : "I saw this too"}
        </button>

        <button
          type="button"
          onClick={onDispute}
          disabled={isActing}
          className="rounded-lg border border-neutral-700 px-3 py-2.5 text-sm disabled:opacity-40"
        >
          Dispute
        </button>
      </div>
    </article>
  );
}
