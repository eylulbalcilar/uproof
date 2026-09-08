import cors from "cors";
import express from "express";
import fs from "node:fs";
import multer from "multer";
import path from "node:path";
import { db, type Submission, type SubmissionStatus } from "./db.ts";

const uploadsDir = path.resolve(import.meta.dirname, "uploads");
fs.mkdirSync(path.join(uploadsDir, "photos"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "pdfs"), { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(uploadsDir, file.fieldname === "pdf" ? "pdfs" : "photos"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.fieldname === "pdf" ? ".pdf" : ".jpg");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/profile", async (_req, res) => {
  await db.read();
  res.json(db.data.profile);
});

app.get("/api/submissions", async (_req, res) => {
  await db.read();
  const list = [...db.data.submissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

app.get("/api/submissions/:id", async (req, res) => {
  await db.read();
  const submission = db.data.submissions.find((s) => s.id === req.params.id);
  if (!submission) return res.status(404).json({ error: "Submission not found" });
  res.json(submission);
});

app.post(
  "/api/submissions",
  upload.fields([{ name: "photo", maxCount: 1 }, { name: "pdf", maxCount: 1 }]),
  async (req, res) => {
    const files = req.files as { photo?: Express.Multer.File[]; pdf?: Express.Multer.File[] } | undefined;
    const photoFile = files?.photo?.[0];
    const pdfFile = files?.pdf?.[0];
    const { mealType, note, timestamp } = req.body ?? {};

    if (!mealType || !photoFile) {
      return res.status(400).json({ error: "mealType and a photo file are required" });
    }

    let gps: { lat: number; lng: number } | null = null;
    try {
      gps = req.body?.gps ? JSON.parse(req.body.gps) : null;
    } catch {
      gps = null;
    }

    await db.read();
    const id = `SUB-${String(db.data.nextId).padStart(4, "0")}`;
    db.data.nextId += 1;

    const submission: Submission = {
      id,
      mealType,
      description: typeof note === "string" && note.trim() ? note.trim() : mealType,
      note: typeof note === "string" ? note : "",
      hasPdf: Boolean(pdfFile),
      pdfName: pdfFile?.originalname ?? null,
      pdfUrl: pdfFile ? `/uploads/pdfs/${pdfFile.filename}` : null,
      photoUrl: `/uploads/photos/${photoFile.filename}`,
      gps,
      timestamp: timestamp ?? new Date().toISOString(),
      status: "in_progress",
      createdAt: new Date().toISOString(),
    };

    db.data.submissions.unshift(submission);
    await db.write();

    res.status(201).json(submission);
  }
);

app.patch("/api/submissions/:id", async (req, res) => {
  const status = req.body?.status as SubmissionStatus | undefined;
  if (!status || !["approved", "rejected", "in_progress"].includes(status)) {
    return res.status(400).json({ error: "status must be approved, rejected, or in_progress" });
  }

  await db.read();
  const submission = db.data.submissions.find((s) => s.id === req.params.id);
  if (!submission) return res.status(404).json({ error: "Submission not found" });

  submission.status = status;
  await db.write();
  res.json(submission);
});

app.get("/api/dashboard", async (_req, res) => {
  await db.read();
  const submissions = [...db.data.submissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = submissions[0] ?? null;
  const mealsReceived = submissions.length;
  const reportsUploaded = submissions.filter((s) => s.hasPdf).length;
  const programDays = new Set(submissions.map((s) => s.timestamp.slice(0, 10))).size;

  res.json({
    profile: db.data.profile,
    latest,
    history: submissions,
    stats: { mealsReceived, reportsUploaded, programDays },
  });
});

const PORT = Number(process.env.API_PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
