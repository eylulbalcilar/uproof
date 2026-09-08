import { useState, useEffect, useRef, useCallback } from "react";
import { getDashboard, updateSubmissionStatus, type Dashboard } from "./lib/api";

// ── Data (illustrative global-impact explorer — not backed by real regional data) ──

const REGIONS = {
  "Global": ["All Programs"],
  "East Africa": ["Kenya", "Ethiopia", "Tanzania", "Uganda"],
  "West Africa": ["Nigeria", "Ghana", "Senegal", "Mali"],
  "South Asia": ["India", "Bangladesh", "Nepal", "Pakistan"],
  "Latin America": ["Brazil", "Peru", "Colombia", "Bolivia"],
};

const CITIES: Record<string, string[]> = {
  "Kenya": ["Nairobi", "Mombasa", "Kisumu"],
  "Ethiopia": ["Addis Ababa", "Dire Dawa", "Hawassa"],
  "Tanzania": ["Dar es Salaam", "Dodoma", "Arusha"],
  "Nigeria": ["Lagos", "Abuja", "Kano"],
  "India": ["Mumbai", "Delhi", "Kolkata", "Chennai"],
  "Bangladesh": ["Dhaka", "Chittagong", "Sylhet"],
  "Brazil": ["São Paulo", "Rio de Janeiro", "Salvador"],
};

const PROGRAMS = [
  "Nutrition Support",
  "Iron Deficiency Treatment",
  "Child Health Monitoring",
  "Emergency Food Aid",
  "Maternal Health",
];

type ProgramData = {
  donationsCollected: number;
  valueSpent: number;
};

function generateData(region: string, sub: string, city: string, program: string): ProgramData {
  const seed = (region + sub + city + program).length * 17 + region.length * 43;
  const donationsCollected = 50_000 + ((seed * 733) % 450_000);
  const utilization = 0.5 + ((seed * 91) % 35) / 100; // 50%–85% of funds disbursed
  return {
    donationsCollected,
    valueSpent: Math.floor(donationsCollected * utilization),
  };
}

// ── Globe SVG (shared) ────────────────────────────────────────────────────────

function GlobeIcon({ id = "globeGrad" }: { id?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="100" cy="100" r="96" fill={`url(#${id})`} />
      {[30, 60, 100, 140, 170].map((y, i) => {
        const r = Math.sqrt(96 * 96 - (y - 100) * (y - 100));
        return <ellipse key={i} cx="100" cy={y} rx={r} ry={r * 0.18} stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" fill="none" />;
      })}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <ellipse key={i} cx="100" cy="100" rx={96 * Math.cos((i * Math.PI) / 6)} ry="96" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" fill="none" />
      ))}
      <path d="M95 65 Q108 62 115 72 Q122 84 118 100 Q114 116 110 122 Q105 130 100 128 Q92 124 88 112 Q82 98 84 82 Q86 68 95 65Z" fill="rgba(255,255,255,0.45)" />
      <path d="M82 52 Q90 48 98 50 Q104 54 102 62 Q98 65 90 63 Q82 61 80 56Z" fill="rgba(255,255,255,0.4)" />
      <path d="M108 50 Q124 44 138 52 Q148 60 145 72 Q140 78 130 76 Q118 72 112 64 Q106 58 108 50Z" fill="rgba(255,255,255,0.4)" />
      <path d="M50 72 Q58 68 64 76 Q68 86 64 98 Q60 108 54 106 Q46 100 44 88 Q42 76 50 72Z" fill="rgba(255,255,255,0.35)" />
      <path d="M138 118 Q148 114 152 122 Q154 130 148 134 Q140 136 136 128 Q132 120 138 118Z" fill="rgba(255,255,255,0.3)" />
      <line x1="4" y1="100" x2="196" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6" strokeDasharray="4 4" />
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#00C6FF" />
          <stop offset="50%" stopColor="#00AEEF" />
          <stop offset="100%" stopColor="#005F8E" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// ── Intro / Splash Page ───────────────────────────────────────────────────────

function AdminIntro({ onEnter }: { onEnter: () => void }) {
  const rotationRef = useRef(0);
  const velocityRef = useRef(0.3);
  const isDraggingRef = useRef(false);
  const lastXRef = useRef(0);
  const rafRef = useRef<number>(0);
  const globeRef = useRef<HTMLDivElement>(null);

  const animate = useCallback(() => {
    if (!isDraggingRef.current) {
      velocityRef.current = velocityRef.current * 0.98 + 0.3 * 0.02;
      rotationRef.current += velocityRef.current;
    }
    if (globeRef.current) {
      globeRef.current.style.transform = `rotateY(${rotationRef.current}deg)`;
    }
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  function onPointerDown(e: React.PointerEvent) {
    isDraggingRef.current = true;
    lastXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    velocityRef.current = dx * 0.6;
    rotationRef.current += dx * 0.6;
  }

  function onPointerUp() {
    isDraggingRef.current = false;
  }

  return (
    <div
      className="relative h-full flex flex-col items-center justify-between select-none overflow-hidden"
      style={{ background: "linear-gradient(180deg, #003D6B 0%, #005F8E 40%, #00AEEF 100%)" }}
    >
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              top: `${(i * 137.5) % 100}%`,
              left: `${(i * 97.3) % 100}%`,
              opacity: 0.15 + (i % 5) * 0.1,
            }}
          />
        ))}
      </div>

      {/* Logo — large */}
      <div className="relative z-10 flex flex-col items-center pt-16 gap-4">
        <div className="w-20 h-20 bg-white rounded-[22px] flex items-center justify-center shadow-2xl">
          <span className="text-[#00AEEF] font-black text-4xl leading-none">U</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-baseline gap-1">
            <span className="text-white font-black text-4xl leading-none tracking-tight">-proof</span>
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/60">by UNICEF</div>
        </div>
        <p className="text-white/60 text-sm text-center max-w-[240px] leading-relaxed mt-1">
          Staff console for<br />verifying aid.
        </p>
      </div>

      {/* Interactive Globe */}
      <div className="relative flex-1 flex items-center justify-center w-full">
        <div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 320, height: 320, background: "radial-gradient(circle, rgba(0,174,239,0.35) 0%, transparent 70%)" }}
        />
        <div className="absolute rounded-full border border-white/10 pulse-ring" style={{ width: 310, height: 310 }} />
        <div className="absolute rounded-full border border-white/8 pulse-ring" style={{ width: 310, height: 310, animationDelay: "1s" }} />

        <div
          className="cursor-grab active:cursor-grabbing"
          style={{ perspective: 800, width: 260, height: 260 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div ref={globeRef} style={{ transformStyle: "preserve-3d", width: "100%", height: "100%" }}>
            <GlobeIcon id="introGlobeGrad" />
          </div>
        </div>

        <div className="absolute bottom-4 flex flex-col items-center gap-1 pointer-events-none">
          <div className="flex items-center gap-2 text-white/40 text-xs font-medium">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Drag to spin
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: "scaleX(-1)" }}>
              <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="relative z-10 w-full px-6 pb-12 flex flex-col items-center gap-4">
        <button
          onClick={onEnter}
          className="w-full max-w-sm bg-white text-[#00AEEF] font-bold text-base rounded-2xl py-4 shadow-xl hover:bg-[#E8F8FF] active:scale-[0.97] transition-all"
        >
          Open Dashboard
        </button>
        <div className="text-white/30 text-xs">Protected by UNICEF Privacy Policy</div>
      </div>
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────

function FilterSelect({
  label, value, options, onChange, disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] px-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none bg-white border border-[#E5E9F0] rounded-xl px-3 py-2.5 pr-8 text-sm font-medium text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/40 focus:border-[#00AEEF] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Admin Portal ──────────────────────────────────────────────────────────────

export default function AdminPortal({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<"intro" | "dashboard">("intro");
  const [region, setRegion] = useState("East Africa");
  const [subRegion, setSubRegion] = useState("Kenya");
  const [city, setCity] = useState("All Cities");
  const [program, setProgram] = useState("Iron Deficiency Treatment");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const subOptions = ["All", ...(REGIONS[region as keyof typeof REGIONS] || [])];
  const cityOptions = ["All Cities", ...(CITIES[subRegion] || [])];

  useEffect(() => {
    const opts = REGIONS[region as keyof typeof REGIONS] || [];
    setSubRegion(opts[0] === "All Programs" ? "All Programs" : opts[0]);
    setCity("All Cities");
  }, [region]);

  useEffect(() => {
    setCity("All Cities");
  }, [subRegion]);

  useEffect(() => {
    if (page !== "dashboard") return;
    let cancelled = false;
    const load = () => {
      getDashboard()
        .then((d) => { if (!cancelled) { setDashboard(d); setDashboardError(null); } })
        .catch((err) => { if (!cancelled) setDashboardError(err instanceof Error ? err.message : "Could not reach the server"); });
    };
    load();
    const interval = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [page]);

  async function review(id: string, status: "approved" | "rejected") {
    setActingId(id);
    try {
      await updateSubmissionStatus(id, status);
      setDashboard(await getDashboard());
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : "Could not update submission");
    } finally {
      setActingId(null);
    }
  }

  if (page === "intro") return <AdminIntro onEnter={() => setPage("dashboard")} />;

  const data = generateData(region, subRegion, city, program);
  const utilizationPct = Math.round((data.valueSpent / data.donationsCollected) * 100);
  const remaining = data.donationsCollected - data.valueSpent;

  return (
    <div className="h-full bg-[#F5F7FA] flex flex-col overflow-y-auto">
      {/* Top bar */}
      <header className="bg-white border-b border-[#E5E9F0] px-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#00AEEF] rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm leading-none">U</span>
            </div>
            <div>
              <span className="text-[#1A1A2E] font-bold text-base leading-none">-proof</span>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-[#00AEEF] leading-none mt-0.5">by UNICEF</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#E8F8FF] px-3 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00AEEF] animate-pulse" />
              <span className="text-xs font-semibold text-[#00AEEF]">Live Dashboard</span>
            </div>
            <button onClick={onLogout} className="text-xs font-semibold text-[#6B7280] hover:text-[#1A1A2E] px-2 py-1.5 transition-colors">
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Globe hero */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(160deg, #00AEEF 0%, #0077B6 100%)" }}>
        <div className="max-w-4xl mx-auto px-5 py-5 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Global Impact</div>
            <h1 className="text-white text-xl font-extrabold leading-tight">Verified Aid, Real Results</h1>
          </div>

          <div className="relative flex-shrink-0">
            <div className="globe-container w-16 h-16">
              <div className="globe-sphere w-16 h-16 drop-shadow-xl">
                <GlobeIcon id="dashGlobeGrad" />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#F5F7FA]" style={{ borderRadius: "24px 24px 0 0" }} />
      </div>

      {/* Filters */}
      <div className="max-w-4xl mx-auto w-full px-5 mt-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5E9F0]">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-3">Filters</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FilterSelect label="Region" value={region} options={Object.keys(REGIONS)} onChange={setRegion} />
            <FilterSelect label="Sub-region" value={subRegion} options={subOptions} onChange={setSubRegion} disabled={subOptions.length <= 1} />
            <FilterSelect label="City" value={city} options={cityOptions} onChange={setCity} disabled={cityOptions.length <= 1} />
            <FilterSelect label="Program" value={program} options={PROGRAMS} onChange={setProgram} />
          </div>
        </div>
      </div>

      {/* Funding — changes live with the selected filters */}
      <div className="max-w-4xl mx-auto w-full px-5 mt-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5E9F0]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Funding · {subRegion}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-[#6B7280]">Collected</div>
              <div className="text-xl font-bold text-[#1A1A2E]">${data.donationsCollected.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-[#6B7280]">Spent</div>
              <div className="text-xl font-bold text-[#F59E0B]">${data.valueSpent.toLocaleString()}</div>
            </div>
          </div>
          <div className="h-2 bg-[#F0F4F8] rounded-full overflow-hidden mt-3">
            <div className="h-full rounded-full bg-[#00AEEF] transition-all duration-500" style={{ width: `${utilizationPct}%` }} />
          </div>
          <div className="text-xs text-[#6B7280] mt-1.5">{utilizationPct}% utilized · ${remaining.toLocaleString()} remaining</div>
        </div>
      </div>

      {/* Real submissions queue — backed by the citizen app's API, independent of the filters above */}
      <div className="max-w-4xl mx-auto w-full px-5 mt-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E5E9F0]">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold text-[#1A1A2E]">Submissions Review Queue</div>
            {dashboard && <div className="text-xs text-[#6B7280]">{dashboard.history.length} total</div>}
          </div>

          {dashboardError && <p className="text-red-500 text-xs font-semibold mb-3">{dashboardError}</p>}
          {!dashboard && !dashboardError && <p className="text-[#6B7280] text-xs">Loading…</p>}
          {dashboard && dashboard.history.length === 0 && <p className="text-[#6B7280] text-xs text-center py-4">No submissions yet.</p>}

          <div className="flex flex-col gap-3">
            {dashboard?.history.map((sub) => {
              const badge =
                sub.status === "approved" ? { label: "Verified", cls: "bg-[#E8FFF3] text-[#00B865]" }
                : sub.status === "rejected" ? { label: "Rejected", cls: "bg-[#FFF0F0] text-[#EF4444]" }
                : { label: "Pending", cls: "bg-[#FFF6E8] text-[#F59E0B]" };
              return (
                <div key={sub.id} className="flex items-center gap-3 border-b border-[#F0F4F8] last:border-0 pb-3 last:pb-0">
                  <div className="w-9 h-9 rounded-xl bg-[#F5F7FA] flex-shrink-0 overflow-hidden">
                    <img src={sub.photoUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#1A1A2E] truncate">{sub.description}</div>
                    <div className="text-xs text-[#6B7280]">
                      {new Date(sub.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {sub.hasPdf ? " · PDF" : ""}
                    </div>
                  </div>
                  {sub.status === "in_progress" ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => review(sub.id, "approved")}
                        disabled={actingId === sub.id}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E8FFF3] text-[#00B865] disabled:opacity-40 transition-opacity"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => review(sub.id, "rejected")}
                        disabled={actingId === sub.id}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FFF0F0] text-[#EF4444] disabled:opacity-40 transition-opacity"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
