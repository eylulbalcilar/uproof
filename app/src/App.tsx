import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createSubmission, getDashboard, type Dashboard } from "./lib/api";
import AdminPortal from "./AdminDashboard";
import { useSubmitProof } from "./hooks/useSubmitProof";

type Screen = "login" | "welcome" | "permissions" | "camera" | "submit" | "dashboard" | "admin";

// Demo-only client-side gate — there's no real staff account system here.
const ADMIN_CODE = "UNICEF2026";

const CYAN = "#00AEEF";
const CYAN_DARK = "#008BC5";

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ size = "md", dark = false }: { size?: "sm" | "md" | "lg"; dark?: boolean }) {
  const s = { sm: 24, md: 32, lg: 44 }[size];
  const text = { sm: "text-base", md: "text-xl", lg: "text-3xl" }[size];
  const sub = { sm: "text-[9px]", md: "text-[11px]", lg: "text-sm" }[size];
  return (
    <div className="flex items-end gap-1.5">
      <div className="flex items-center gap-1">
        <div
          style={{ width: s, height: s, background: dark ? "white" : CYAN }}
          className="rounded-lg flex items-center justify-center"
        >
          <span
            style={{ color: dark ? CYAN : "white", fontFamily: "Inter", fontWeight: 900 }}
            className={`${text} leading-none`}
          >U</span>
        </div>
        <span
          style={{ color: dark ? "white" : "#111", fontFamily: "Inter", fontWeight: 900 }}
          className={`${text} tracking-tight`}
        >-proof</span>
      </div>
      <span
        style={{ color: dark ? "rgba(255,255,255,0.55)" : "#888", fontFamily: "Inter", fontWeight: 600 }}
        className={`${sub} uppercase tracking-widest mb-0.5`}
      >by UNICEF</span>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function Badge({ status }: { status: "approved" | "rejected" | "in_progress" }) {
  const map = {
    approved: { label: "Approved", bg: "#ECFDF5", color: "#059669", dot: "#10B981" },
    rejected: { label: "Rejected", bg: "#FEF2F2", color: "#DC2626", dot: "#EF4444" },
    in_progress: { label: "In Review", bg: "#FFFBEB", color: "#D97706", dot: "#F59E0B" },
  }[status];
  return (
    <span
      style={{ background: map.bg, color: map.color }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
    >
      <span style={{ background: map.dot }} className="w-1.5 h-1.5 rounded-full" />
      {map.label}
    </span>
  );
}

// ─── Screen: Login (role select) ───────────────────────────────────────────────
function LoginScreen({ onCitizen, onAdmin }: { onCitizen: () => void; onAdmin: () => void }) {
  const [role, setRole] = useState<"citizen" | "admin" | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitAdminCode = () => {
    if (code.trim().toUpperCase() === ADMIN_CODE) {
      onAdmin();
    } else {
      setError("Incorrect code — contact your program coordinator.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-7 pt-16 pb-10 flex flex-col items-center" style={{ background: `linear-gradient(160deg, ${CYAN} 0%, ${CYAN_DARK} 100%)` }}>
        <Logo size="lg" dark />
        <p className="mt-4 text-white/70 text-sm font-medium text-center">Sign in to continue</p>
      </div>

      <div className="flex-1 flex flex-col gap-3 px-6 pt-8 pb-10">
        <button
          onClick={() => { setRole("citizen"); setError(null); }}
          className="flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all"
          style={{ borderColor: role === "citizen" ? CYAN : "#E5E7EB", background: role === "citizen" ? "#F0FAFF" : "white" }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: "#F0FAFF" }}>🧑</div>
          <div className="flex-1">
            <p className="font-black text-gray-900 text-sm">Citizen</p>
            <p className="text-xs text-gray-400 mt-0.5">Submit meals and track your aid status</p>
          </div>
        </button>

        {role === "citizen" && (
          <button
            onClick={onCitizen}
            className="w-full py-3.5 rounded-2xl text-white text-sm font-black tracking-wide"
            style={{ background: `linear-gradient(90deg, ${CYAN} 0%, ${CYAN_DARK} 100%)` }}
          >
            Continue as Citizen →
          </button>
        )}

        <button
          onClick={() => { setRole("admin"); setError(null); }}
          className="flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all mt-2"
          style={{ borderColor: role === "admin" ? CYAN : "#E5E7EB", background: role === "admin" ? "#F0FAFF" : "white" }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: "#F0FAFF" }}>🛡️</div>
          <div className="flex-1">
            <p className="font-black text-gray-900 text-sm">UNICEF Staff</p>
            <p className="text-xs text-gray-400 mt-0.5">Review submissions and monitor impact</p>
          </div>
        </button>

        {role === "admin" && (
          <div className="flex flex-col gap-2 mt-1">
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && submitAdminCode()}
              placeholder="Staff access code"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder-gray-300 font-medium focus:outline-none"
              style={{ borderColor: error ? "#EF4444" : code ? CYAN : undefined }}
            />
            {error && <p className="text-red-500 text-xs font-semibold px-1">{error}</p>}
            <p className="text-gray-300 text-[10px] px-1">Demo code: {ADMIN_CODE}</p>
            <button
              onClick={submitAdminCode}
              className="w-full py-3.5 rounded-2xl text-white text-sm font-black tracking-wide"
              style={{ background: `linear-gradient(90deg, ${CYAN} 0%, ${CYAN_DARK} 100%)` }}
            >
              Staff Sign In →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Screen: Welcome ──────────────────────────────────────────────────────────
function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#fff" }}>
      {/* Big cyan hero */}
      <div
        className="relative flex flex-col items-start justify-end px-7 pt-16 pb-10"
        style={{ background: `linear-gradient(160deg, ${CYAN} 0%, ${CYAN_DARK} 100%)`, minHeight: "55%" }}
      >
        {/* Decorative rings */}
        <div className="absolute top-8 right-6 w-40 h-40 rounded-full border border-white/10" />
        <div className="absolute top-16 right-14 w-24 h-24 rounded-full border border-white/15" />
        {/* Meal icon */}
        <div className="absolute top-12 right-8 w-28 h-28 rounded-3xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
            <rect x="8" y="28" width="44" height="20" rx="10" fill="white" fillOpacity="0.9" />
            <path d="M8 36h44" stroke="rgba(0,174,239,0.4)" strokeWidth="1.5" />
            <circle cx="30" cy="18" r="6" fill="white" fillOpacity="0.7" />
            <path d="M24 18h12" stroke="rgba(0,174,239,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="42" cy="22" r="8" fill="#10B981" />
            <path d="M38.5 22l2.5 2.5L45 19" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <Logo size="md" dark />
        <h1 className="mt-6 text-white font-black text-4xl leading-[1.1] tracking-tight">
          Aid that's<br />verified,<br />every meal.
        </h1>
        <p className="mt-3 text-white/70 text-sm font-medium leading-relaxed max-w-[240px]">
          Snap a photo of your meal. UNICEF reviews it. Your nutrition support is confirmed.
        </p>
      </div>

      {/* White bottom sheet */}
      <div className="flex-1 flex flex-col px-7 pt-8 pb-10 gap-5" style={{ background: "white" }}>
        <div className="flex flex-col gap-3">
          {[
            { icon: "📸", title: "Photo proof", desc: "Snap your meal — GPS & time auto-attached" },
            { icon: "📋", title: "Medical tracking", desc: "Upload PDFs to show iron-level progress" },
            { icon: "✅", title: "UNICEF validation", desc: "Get approved and track your impact" },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
                style={{ background: "#F0FAFF" }}
              >{f.icon}</div>
              <div>
                <p className="text-sm font-bold text-gray-900">{f.title}</p>
                <p className="text-xs text-gray-400 font-medium">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onNext}
          className="mt-auto w-full py-4 rounded-2xl text-white text-base font-black tracking-wide"
          style={{ background: `linear-gradient(90deg, ${CYAN} 0%, ${CYAN_DARK} 100%)` }}
        >
          Get Started
        </button>
        <p className="text-center text-xs text-gray-400">Protected by UNICEF Privacy Policy</p>
      </div>
    </div>
  );
}

// ─── Screen: Permissions ──────────────────────────────────────────────────────
function PermissionsScreen({ onNext, onLocation }: { onNext: () => void; onLocation: (gps: { lat: number; lng: number }) => void }) {
  const [granted, setGranted] = useState({ camera: false, files: false, location: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const count = Object.values(granted).filter(Boolean).length;
  const all = count === 3;

  const items = [
    {
      key: "camera" as const,
      emoji: "📷",
      title: "Camera",
      desc: "Photograph meals for UNICEF verification",
    },
    {
      key: "files" as const,
      emoji: "📄",
      title: "Documents",
      desc: "Upload PDF medical results (iron levels, etc.)",
    },
    {
      key: "location" as const,
      emoji: "📍",
      title: "Location",
      desc: "GPS coordinates required for submission approval",
    },
  ];

  const requestPermission = async (key: "camera" | "files" | "location") => {
    setBusy(key);
    setErrors((e) => ({ ...e, [key]: "" }));
    try {
      if (key === "camera") {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
      } else if (key === "location") {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
        );
        onLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
      setGranted((g) => ({ ...g, [key]: true }));
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: err instanceof Error ? err.message : "Permission denied" }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 pt-14 pb-8" style={{ background: `linear-gradient(160deg, ${CYAN} 0%, ${CYAN_DARK} 100%)` }}>
        <Logo size="sm" dark />
        <h2 className="mt-5 text-white font-black text-3xl leading-tight">Allow access</h2>
        <p className="mt-1 text-white/65 text-sm">These permissions are required to submit and verify aid</p>
      </div>

      <div className="flex-1 flex flex-col gap-3 px-6 pt-7 pb-4 overflow-y-auto">
        {items.map(({ key, emoji, title, desc }) => {
          const on = granted[key];
          const isBusy = busy === key;
          const err = errors[key];
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <div
                className="flex items-center gap-4 p-4 rounded-2xl border transition-all"
                style={{
                  background: on ? "#F0FAFF" : "#FAFAFA",
                  borderColor: on ? CYAN : "#E5E7EB",
                }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: on ? "white" : "#F3F4F6" }}
                >{emoji}</div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">{title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-snug">{desc}</p>
                </div>
                {on ? (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: CYAN }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ) : (
                  <button
                    onClick={() => requestPermission(key)}
                    disabled={isBusy}
                    className="px-4 py-2 rounded-xl text-xs font-black text-white shrink-0"
                    style={{ background: CYAN, opacity: isBusy ? 0.6 : 1 }}
                  >
                    {isBusy ? "…" : "Allow"}
                  </button>
                )}
              </div>
              {err && <p className="text-red-500 text-[10px] font-semibold px-1">{err}</p>}
            </div>
          );
        })}

        <div className="mt-1 bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-amber-700 text-xs font-semibold leading-relaxed">
            🔒 Your data is end-to-end encrypted and only visible to authorized UNICEF field staff.
          </p>
        </div>
      </div>

      <div className="px-6 pb-12 pt-2">
        {/* Progress indicator */}
        <div className="flex gap-1 mb-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-all"
              style={{ background: i < count ? CYAN : "#E5E7EB" }}
            />
          ))}
        </div>
        <button
          onClick={onNext}
          disabled={!all}
          className="w-full py-4 rounded-2xl text-base font-black tracking-wide transition-all"
          style={{
            background: all ? `linear-gradient(90deg, ${CYAN} 0%, ${CYAN_DARK} 100%)` : "#F3F4F6",
            color: all ? "white" : "#9CA3AF",
          }}
        >
          {all ? "Continue →" : `${count} of 3 allowed`}
        </button>
      </div>
    </div>
  );
}

// ─── Screen: Camera ───────────────────────────────────────────────────────────
function CameraScreen({ gps, onCapture, onBack }: { gps: { lat: number; lng: number } | null; onCapture: (file: File, previewUrl: string) => void; onBack: () => void }) {
  const [captured, setCaptured] = useState(false);
  const [flash, setFlash] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => {
        if (!cancelled) setCameraError(err instanceof Error ? err.message : "Camera unavailable");
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const finishCapture = (file: File, url: string) => {
    setCapturedFile(file);
    setPreviewUrl(url);
    setCaptured(true);
  };

  const shutter = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !video.videoWidth) return;
    canvas!.width = video.videoWidth;
    canvas!.height = video.videoHeight;
    const ctx = canvas!.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas!.width, canvas!.height);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    canvas!.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `meal-${Date.now()}.jpg`, { type: "image/jpeg" });
      finishCapture(file, URL.createObjectURL(blob));
    }, "image/jpeg", 0.9);
  };

  const onGalleryPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    finishCapture(file, URL.createObjectURL(file));
    e.target.value = "";
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCapturedFile(null);
    setCaptured(false);
  };

  const now = new Date();

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Status bar area */}
      <div className="relative">
        {flash && <div className="absolute inset-0 z-50 bg-white pointer-events-none" />}

        {/* Photo / viewfinder */}
        <div className="relative overflow-hidden bg-black" style={{ height: "72%" }}>
          {captured && previewUrl ? (
            <img src={previewUrl} alt="Captured meal" className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          )}
          <canvas ref={canvasRef} className="hidden" />

          {cameraError && !captured && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-8 text-center">
              <p className="text-white/80 text-sm font-semibold">Camera unavailable</p>
              <p className="text-white/40 text-xs">{cameraError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-black text-white"
                style={{ background: CYAN }}
              >
                Choose photo instead
              </button>
            </div>
          )}

          {/* Top controls */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 pb-4"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)" }}>
            <button onClick={onBack} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11 4L6 9l5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: gps ? CYAN : "#9CA3AF" }} />
              <span className="text-white text-xs font-bold">{gps ? "GPS Active" : "GPS unavailable"}</span>
            </div>
            <div className="w-9" />
          </div>

          {/* Corner guides — only when not captured */}
          {!captured && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-56">
                {[["top-0 left-0", "border-t-2 border-l-2"], ["top-0 right-0", "border-t-2 border-r-2"], ["bottom-0 left-0", "border-b-2 border-l-2"], ["bottom-0 right-0", "border-b-2 border-r-2"]].map(([pos, border]) => (
                  <div key={pos} className={`absolute ${pos} w-6 h-6 ${border} border-white rounded-sm`} />
                ))}
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-white/80 text-xs font-semibold text-center bg-black/30 backdrop-blur px-3 py-1.5 rounded-full">
                    Center your meal
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Captured overlay */}
          {captured && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-3xl px-8 py-6 text-center shadow-2xl">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: "#ECFDF5" }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M6 14l5 5 11-11" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="font-black text-gray-900 text-base">Photo captured</p>
                <p className="text-gray-400 text-xs mt-1">GPS + timestamp verified</p>
              </div>
            </div>
          )}

          {/* Bottom metadata */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between"
            style={{ background: "transparent" }}>
            <div className="bg-black/50 backdrop-blur-sm rounded-xl px-3 py-2">
              <p className="text-white/50 text-[9px] font-mono uppercase">TIMESTAMP</p>
              <p className="text-white text-[10px] font-mono font-bold">{now.toLocaleDateString()} {now.toLocaleTimeString()}</p>
            </div>
            <div className="bg-black/50 backdrop-blur-sm rounded-xl px-3 py-2">
              <p className="text-white/50 text-[9px] font-mono uppercase">LOCATION</p>
              <p className="text-white text-[10px] font-mono font-bold">
                {gps ? `${gps.lat.toFixed(4)}° N, ${Math.abs(gps.lng).toFixed(4)}° ${gps.lng < 0 ? "W" : "E"}` : "No GPS fix"}
              </p>
            </div>
          </div>
        </div>

        {/* Controls bar */}
        <div className="bg-black px-6 py-6 flex items-center justify-between" style={{ height: "28%" }}>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onGalleryPick} />

          <button
            onClick={retake}
            disabled={!captured}
            className="flex flex-col items-center gap-1.5"
            style={{ opacity: captured ? 1 : 0.3 }}
          >
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10a6 6 0 106-6H6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6 7V4H3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-white/40 text-[10px] font-semibold">Retake</span>
          </button>

          {!captured ? (
            <button
              onClick={shutter}
              disabled={!!cameraError}
              className="w-20 h-20 rounded-full border-4 border-white/80 p-1.5 active:scale-95 transition-transform disabled:opacity-30"
            >
              <div className="w-full h-full rounded-full bg-white" />
            </button>
          ) : (
            <button
              onClick={() => capturedFile && previewUrl && onCapture(capturedFile, previewUrl)}
              className="px-8 py-4 rounded-2xl text-white font-black text-sm active:scale-95 transition-transform"
              style={{ background: `linear-gradient(90deg, ${CYAN}, ${CYAN_DARK})` }}
            >
              Use Photo →
            </button>
          )}

          <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-lg">
              🖼️
            </div>
            <span className="text-white/40 text-[10px] font-semibold">Gallery</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Submit ───────────────────────────────────────────────────────────
function SubmitScreen({ photoFile, photoPreview, gps, onSubmit, onBack }: {
  photoFile: File | null;
  photoPreview: string | null;
  gps: { lat: number; lng: number } | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
    const [mealType, setMealType] = useState("Lunch");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const now = new Date();
  const { submit: anchorOnChain } = useSubmitProof();
  const onPdfPick = (e: ChangeEvent<HTMLInputElement>) => {
    setPdfFile(e.target.files?.[0] ?? null);
  };
  const submit = async () => {
    if (!photoFile) {
      setError("No photo attached — go back and capture a meal photo.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Anchor on chain first. The signature is made here, at capture time, and
      // stays valid whether or not the backend is reachable.
      await anchorOnChain({
        taskId: mealType,
        imageBlob: photoFile,
        latitude: gps?.lat ?? 0,
        longitude: gps?.lng ?? 0,
        capturedAt: Math.floor(now.getTime() / 1000),
      });
      await createSubmission({ mealType, note, photoFile, pdfFile, gps, timestamp: now.toISOString() });
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 pt-12 pb-5 flex items-center gap-3 border-b border-gray-100">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <p className="font-black text-gray-900 text-lg leading-tight">Review & Submit</p>
          <p className="text-xs text-gray-400 font-medium">UNF-2026-MX-04821</p>
        </div>
        <div className="ml-auto">
          <Badge status="in_progress" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
        {/* Photo */}
        <div className="relative rounded-3xl overflow-hidden aspect-video bg-gray-100 shadow-sm">
          {photoPreview ? (
            <img src={photoPreview} alt="Meal" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">📷</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
            <div>
              <p className="text-white font-black text-sm">{now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              <p className="text-white/60 text-xs">{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <div className={`flex items-center gap-1 text-white text-[10px] font-black px-2 py-1 rounded-full ${gps ? "bg-green-500" : "bg-gray-400"}`}>
              {gps ? (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1 4l2.5 2.5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
              {gps ? "GPS verified" : "No GPS"}
            </div>
          </div>
        </div>

        {/* Meal type */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Meal type</p>
          <div className="flex gap-2">
            {["Breakfast", "Lunch", "Dinner", "Snack"].map((m) => (
              <button
                key={m}
                onClick={() => setMealType(m)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all"
                style={{
                  background: mealType === m ? CYAN : "white",
                  color: mealType === m ? "white" : "#6B7280",
                  borderColor: mealType === m ? CYAN : "#E5E7EB",
                }}
              >{m}</button>
            ))}
          </div>
        </div>

        {/* PDF */}
        <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={onPdfPick} />
        <button
          onClick={() => (pdfFile ? setPdfFile(null) : pdfInputRef.current?.click())}
          className="flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed transition-all text-left"
          style={{
            background: pdfFile ? "#F0FAFF" : "#FAFAFA",
            borderColor: pdfFile ? CYAN : "#D1D5DB",
          }}
        >
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
            style={{ background: pdfFile ? CYAN : "#E5E7EB" }}
          >
            <span style={{ filter: pdfFile ? "none" : "grayscale(1)" }}>📄</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm truncate ${pdfFile ? "text-gray-900" : "text-gray-500"}`}>
              {pdfFile ? pdfFile.name : "Attach medical report (optional)"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {pdfFile ? `${(pdfFile.size / 1024).toFixed(0)} KB · tap to remove` : "Blood test, nutrition report PDF"}
            </p>
          </div>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ background: pdfFile ? "#10B981" : "#E5E7EB" }}
          >
            {pdfFile ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M2 6h8" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </button>

        {/* Note */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Note <span className="normal-case font-normal text-gray-400">— optional</span></p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. day 3 of iron-rich meal program, spinach lentil soup…"
            rows={3}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder-gray-300 font-medium resize-none focus:outline-none transition-colors"
            style={{ borderColor: note ? CYAN : undefined }}
          />
        </div>
      </div>

      <div className="px-5 pt-3 pb-12 border-t border-gray-100">
        {error && (
          <p className="text-red-500 text-xs font-semibold mb-3 text-center">{error}</p>
        )}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 transition-all"
          style={{ background: `linear-gradient(90deg, ${CYAN} 0%, ${CYAN_DARK} 100%)`, opacity: loading ? 0.8 : 1 }}
        >
          {loading ? (
            <>
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="white" strokeWidth="2" strokeOpacity="0.25" />
                <path d="M9 2a7 7 0 017 7" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Sending to UNICEF…
            </>
          ) : "Submit to UNICEF →"}
        </button>
      </div>
    </div>
  );
}

// ─── Screen: Dashboard ────────────────────────────────────────────────────────
function DashboardScreen({ onNew, onLogout }: { onNew: () => void; onLogout: () => void }) {
  const [tab, setTab] = useState<"status" | "impact" | "history">("status");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getDashboard()
        .then((d) => { if (!cancelled) { setData(d); setError(null); } })
        .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not reach the server"); });
    };
    load();
    const interval = setInterval(load, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-4xl">⚠️</p>
        <p className="font-black text-gray-900 text-sm">Can't reach the API</p>
        <p className="text-gray-400 text-xs">{error}</p>
        <p className="text-gray-300 text-[10px]">Make sure the backend is running (pnpm dev:server)</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-300 text-sm font-semibold">Loading…</p>
      </div>
    );
  }

  const { profile, latest, history, stats } = data;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 pt-12 pb-5" style={{ background: `linear-gradient(160deg, ${CYAN} 0%, ${CYAN_DARK} 100%)` }}>
        <div className="flex items-center justify-between mb-5">
          <Logo size="sm" dark />
          <div className="flex items-center gap-2">
            <button onClick={onNew} className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-white text-xs font-bold">New</span>
            </button>
            <button onClick={onLogout} className="text-white/60 text-xs font-bold px-1">
              Switch
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/15 p-1 rounded-xl gap-0.5">
          {(["status", "impact", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-xs font-black capitalize transition-all"
              style={{ background: tab === t ? "white" : "transparent", color: tab === t ? CYAN : "rgba(255,255,255,0.7)" }}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {tab === "status" && (
          <div className="flex flex-col gap-4">
            {/* Latest */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Latest Submission</p>
              {latest ? (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge status={latest.status} />
                  <span className="text-gray-400 text-xs font-mono">{latest.id}</span>
                </div>
                <p className="font-black text-gray-900 text-base">{latest.description} · {latest.mealType}</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {new Date(latest.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" · "}
                  {new Date(latest.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {[
                    { label: "GPS Location", ok: Boolean(latest.gps) },
                    { label: "Timestamp", ok: true },
                    { label: "Photo quality", ok: Boolean(latest.photoUrl) },
                    { label: "Medical PDF", ok: latest.hasPdf, note: latest.hasPdf ? undefined : "Attach to speed up review" },
                  ].map(({ label, ok, note }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: ok ? "#10B981" : "#F3F4F6" }}>
                        {ok ? (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M3 3l4 4M7 3l-4 4" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-xs font-semibold ${ok ? "text-gray-700" : "text-gray-400"}`}>{label}</span>
                      {note && <span className="ml-auto text-[10px] text-amber-600 font-semibold">{note}</span>}
                    </div>
                  ))}
                </div>
              </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl p-6 text-center">
                  <p className="text-gray-400 text-xs font-semibold">No submissions yet — tap New to submit a meal.</p>
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { n: String(stats.mealsReceived), label: "Meals\nReceived", c: CYAN },
                { n: String(stats.reportsUploaded), label: "Reports\nUploaded", c: "#10B981" },
                { n: String(stats.programDays), label: "Program\nDays", c: "#F59E0B" },
              ].map(({ n, label, c }) => (
                <div key={label} className="bg-gray-50 rounded-2xl p-3.5 text-center">
                  <p className="font-black text-2xl leading-none" style={{ color: c }}>{n}</p>
                  <p className="text-gray-400 text-[10px] font-semibold whitespace-pre-line mt-1.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* Next steps */}
            <div className="rounded-2xl p-4" style={{ background: "#F0FAFF" }}>
              <p className="font-black text-sm mb-3" style={{ color: CYAN_DARK }}>Next Steps</p>
              {["Attach your latest iron-level PDF", "Submit next meal after lunch today", "Follow-up blood test: Sept 14"].map((s) => (
                <div key={s} className="flex items-start gap-2 mb-2 last:mb-0">
                  <span className="text-sm mt-0.5" style={{ color: CYAN }}>→</span>
                  <p className="text-gray-600 text-xs font-medium">{s}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "impact" && (
          <div className="flex flex-col gap-4">
            {/* Iron progress */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Iron Level Progress</p>
              <div className="rounded-2xl p-5" style={{ background: `linear-gradient(135deg, ${CYAN}, ${CYAN_DARK})` }}>
                {(() => {
                  const baseline = profile.ironLevels[0]?.value ?? 0;
                  const current = profile.ironLevels[1]?.value ?? baseline;
                  const pctChange = baseline ? Math.round(((current - baseline) / baseline) * 100) : 0;
                  return (
                    <div className="flex items-end justify-between mb-4">
                      <div>
                        <p className="text-white/60 text-xs font-semibold">Current level</p>
                        <p className="text-white font-black text-5xl leading-none">{current} <span className="text-2xl font-bold text-white/60">μg/dL</span></p>
                      </div>
                      <div className="bg-green-400/30 rounded-xl px-3 py-1.5">
                        <p className="text-green-200 text-xs font-black">{pctChange >= 0 ? "+" : ""}{pctChange}% ↑</p>
                        <p className="text-green-300/70 text-[9px]">since baseline</p>
                      </div>
                    </div>
                  );
                })()}
                {profile.ironLevels.map(({ label, value: val }, i) => ({
                  label, val, c: ["rgba(255,255,255,0.4)", "white", "rgba(255,255,255,0.25)"][i],
                })).map(({ label, val, c }) => (
                  <div key={label} className="mb-2">
                    <div className="flex justify-between mb-1">
                      <span className="text-white/60 text-[10px] font-semibold">{label}</span>
                      <span className="text-white text-[10px] font-black">{val} μg/dL</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/15">
                      <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, background: c }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Personal health metrics */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Health Metrics</p>
              <div className="grid grid-cols-2 gap-2">
                {profile.healthMetrics.map((m) => {
                  const flagged = m.status !== "normal";
                  return (
                    <div key={m.label} className="bg-gray-50 rounded-2xl p-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide">{m.label}</p>
                        {flagged && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">
                            {m.status}
                          </span>
                        )}
                      </div>
                      <p className="font-black text-xl leading-none" style={{ color: flagged ? "#EF4444" : "#111827" }}>
                        {m.value}<span className="text-xs font-bold text-gray-400 ml-1">{m.unit}</span>
                      </p>
                      <p className="text-gray-300 text-[10px] font-medium mt-1">Normal: {m.range}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommended health checks */}
            <div className="rounded-2xl p-4" style={{ background: "#FFF6E8" }}>
              <p className="font-black text-sm mb-3" style={{ color: "#B45309" }}>Additional Health Checks Needed</p>
              {profile.recommendedChecks.map((c) => (
                <div key={c.label} className="flex items-start gap-2 mb-2 last:mb-0">
                  <span className="text-sm mt-0.5" style={{ color: c.urgent ? "#EF4444" : "#F59E0B" }}>{c.urgent ? "●" : "→"}</span>
                  <p className="text-gray-700 text-xs font-medium flex-1">
                    {c.label}
                    {c.dueDate && (
                      <span className="text-gray-400"> — due {new Date(c.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    )}
                  </p>
                </div>
              ))}
            </div>

            {/* Meals bar chart */}
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="font-black text-gray-900 text-sm mb-4">Meals this week</p>
              <div className="flex items-end gap-2 h-16">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => ({ day, v: profile.weeklyMeals[i] ?? 0 })).map(({ day, v }, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-lg" style={{ height: `${v * 20}px`, background: i === 6 ? CYAN : "#E5E7EB" }} />
                    <span className="text-[9px] text-gray-400 font-semibold">{day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">All Submissions</p>
            {history.length === 0 && (
              <p className="text-gray-400 text-xs font-semibold text-center py-6">No submissions yet.</p>
            )}
            {history.map((h) => (
              <div key={h.id} className="border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-lg shrink-0">🍲</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 justify-between">
                    <p className="font-bold text-gray-900 text-sm truncate">{h.description}</p>
                    <Badge status={h.status} />
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {new Date(h.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {h.id}
                  </p>
                  <div className="flex gap-3 mt-1.5">
                    <span className={`text-[10px] font-semibold ${h.gps ? "text-green-500" : "text-gray-300"}`}>📍 GPS</span>
                    <span className={`text-[10px] font-semibold ${h.hasPdf ? "text-green-500" : "text-gray-300"}`}>📄 PDF</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#111", fontFamily: "'Inter', sans-serif" }}>
      <div className="relative w-full max-w-[390px] h-full max-h-[844px] bg-white overflow-hidden shadow-2xl flex flex-col">
        {screen === "login" && <LoginScreen onCitizen={() => setScreen("welcome")} onAdmin={() => setScreen("admin")} />}
        {screen === "admin" && <AdminPortal onLogout={() => setScreen("login")} />}
        {screen === "welcome" && <WelcomeScreen onNext={() => setScreen("permissions")} />}
        {screen === "permissions" && <PermissionsScreen onNext={() => setScreen("camera")} onLocation={setGps} />}
        {screen === "camera" && (
          <CameraScreen
            gps={gps}
            onCapture={(file, previewUrl) => { setPhotoFile(file); setPhotoPreview(previewUrl); setScreen("submit"); }}
            onBack={() => setScreen("permissions")}
          />
        )}
        {screen === "submit" && (
          <SubmitScreen
            photoFile={photoFile}
            photoPreview={photoPreview}
            gps={gps}
            onSubmit={() => setScreen("dashboard")}
            onBack={() => setScreen("camera")}
          />
        )}
        {screen === "dashboard" && <DashboardScreen onNew={() => setScreen("camera")} onLogout={() => setScreen("login")} />}
      </div>
    </div>
  );
}
