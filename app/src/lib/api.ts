export type SubmissionStatus = "in_progress" | "approved" | "rejected";

export interface Submission {
  id: string;
  mealType: string;
  description: string;
  note: string;
  hasPdf: boolean;
  pdfName: string | null;
  pdfUrl: string | null;
  photoUrl: string;
  gps: { lat: number; lng: number } | null;
  timestamp: string;
  status: SubmissionStatus;
  createdAt: string;
}

export interface Profile {
  name: string;
  age: number;
  program: string;
  location: string;
  ironLevels: { label: string; date: string | null; value: number }[];
  healthMetrics: { label: string; value: number; unit: string; range: string; status: "normal" | "low" | "high" }[];
  recommendedChecks: { label: string; dueDate: string | null; urgent: boolean }[];
  community: {
    peopleHelped: number;
    mealsDistributed: number;
    familiesNearby: number;
    approvalRate: number;
  };
  weeklyMeals: number[];
}

export interface Dashboard {
  profile: Profile;
  latest: Submission | null;
  history: Submission[];
  stats: { mealsReceived: number; reportsUploaded: number; programDays: number };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request to ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getDashboard() {
  return request<Dashboard>("/api/dashboard");
}

export function createSubmission(payload: {
  mealType: string;
  note: string;
  photoFile: File;
  pdfFile: File | null;
  gps: { lat: number; lng: number } | null;
  timestamp: string;
}) {
  const form = new FormData();
  form.set("mealType", payload.mealType);
  form.set("note", payload.note);
  form.set("timestamp", payload.timestamp);
  form.set("gps", JSON.stringify(payload.gps));
  form.set("photo", payload.photoFile);
  if (payload.pdfFile) form.set("pdf", payload.pdfFile);

  return request<Submission>("/api/submissions", { method: "POST", body: form });
}

export function updateSubmissionStatus(id: string, status: SubmissionStatus) {
  return request<Submission>(`/api/submissions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}
