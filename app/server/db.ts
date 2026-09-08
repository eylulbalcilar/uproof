import path from "node:path";
import { JSONFilePreset } from "lowdb/node";

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

interface Data {
  nextId: number;
  submissions: Submission[];
  profile: Profile;
}

const defaultData: Data = {
  nextId: 42,
  submissions: [
    {
      id: "SUB-0041",
      mealType: "Lunch",
      description: "Lentil soup",
      note: "",
      hasPdf: true,
      pdfName: "lentil_soup_labs.pdf",
      pdfUrl: null,
      photoUrl:
        "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=700&fit=crop&auto=format",
      gps: { lat: 19.4326, lng: -99.1332 },
      timestamp: "2026-09-07T13:10:00.000Z",
      status: "approved",
      createdAt: "2026-09-07T13:10:00.000Z",
    },
    {
      id: "SUB-0038",
      mealType: "Breakfast",
      description: "Iron cereal",
      note: "",
      hasPdf: false,
      pdfName: null,
      pdfUrl: null,
      photoUrl:
        "https://images.unsplash.com/photo-1517686748843-bb360cd1c04d?w=600&h=700&fit=crop&auto=format",
      gps: { lat: 19.4326, lng: -99.1332 },
      timestamp: "2026-09-05T07:42:00.000Z",
      status: "in_progress",
      createdAt: "2026-09-05T07:42:00.000Z",
    },
    {
      id: "SUB-0031",
      mealType: "Lunch",
      description: "Spinach & beans",
      note: "",
      hasPdf: true,
      pdfName: "spinach_beans_labs.pdf",
      pdfUrl: null,
      photoUrl:
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=700&fit=crop&auto=format",
      gps: { lat: 19.4326, lng: -99.1332 },
      timestamp: "2026-09-01T12:30:00.000Z",
      status: "approved",
      createdAt: "2026-09-01T12:30:00.000Z",
    },
    {
      id: "SUB-0027",
      mealType: "Dinner",
      description: "Beef stew",
      note: "",
      hasPdf: false,
      pdfName: null,
      pdfUrl: null,
      photoUrl:
        "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=700&fit=crop&auto=format",
      gps: null,
      timestamp: "2026-08-28T19:05:00.000Z",
      status: "rejected",
      createdAt: "2026-08-28T19:05:00.000Z",
    },
  ],
  profile: {
    name: "Ana Hernández",
    age: 8,
    program: "Iron Deficiency Program",
    location: "Mexico City",
    ironLevels: [
      { label: "Baseline (Aug 30)", date: "2026-08-30", value: 55 },
      { label: "Now (Sept 7)", date: "2026-09-07", value: 73 },
      { label: "Target", date: null, value: 95 },
    ],
    healthMetrics: [
      { label: "Hemoglobin", value: 10.8, unit: "g/dL", range: "11.5–15.5", status: "low" },
      { label: "Weight", value: 24.5, unit: "kg", range: "22–30", status: "normal" },
      { label: "BMI", value: 15.2, unit: "", range: "14–18", status: "normal" },
      { label: "Vitamin D", value: 18, unit: "ng/mL", range: "20–50", status: "low" },
    ],
    recommendedChecks: [
      { label: "Follow-up blood test (hemoglobin)", dueDate: "2026-09-14", urgent: true },
      { label: "Vitamin D supplementation review", dueDate: "2026-09-20", urgent: false },
      { label: "Routine growth check-up", dueDate: "2026-10-01", urgent: false },
    ],
    community: {
      peopleHelped: 1842,
      mealsDistributed: 9320,
      familiesNearby: 47,
      approvalRate: 94,
    },
    weeklyMeals: [1, 2, 1, 3, 2, 1, 2],
  },
};

const dbFile = path.resolve(import.meta.dirname, "data.json");
export const db = await JSONFilePreset<Data>(dbFile, defaultData);
