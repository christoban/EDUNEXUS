// let create a simple server
import cookieParser from "cookie-parser";
import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import cors from "cors";

import userRoutes from "./routes/user.ts";
import masterAdminRouter from "./routes/masterAdmin.ts";
import schoolOnboardingRouter from "./routes/schoolOnboarding.ts";
import LogsRouter from "./routes/activitieslog.ts";
import academicYearRouter from "./routes/academicYear.ts";
import classRouter from "./routes/class.ts";
import subjectRouter from "./routes/subject.ts";
import { serve } from "inngest/express";
import { inngest } from "./inngest/index.ts";
import {
  generateTimeTable,
  generateExam,
  handleExamSubmission,
  generateReportCards,
} from "./inngest/functions.ts";
import timeRouter from "./routes/timetable.ts";
import examRouter from "./routes/exam.ts";
import dashboardRouter from "./routes/dashboard.ts";
import attendanceRouter from "./routes/attendance.ts";
import searchRouter from "./routes/search.ts";
import reportCardRouter from "./routes/reportCard.ts";
import emailLogRouter from "./routes/emailLog.ts";
import parentRouter from "./routes/parent.ts";
import financeRouter from "./routes/finance.ts";
import aiRouter from "./routes/ai.ts";
import schoolSettingsRouter from "./routes/schoolSettings.ts";
import coreDomainRouter from "./routes/coreDomain.ts";
import publicRouter from "./routes/public.ts";
import { initSocket } from "./socket/io.ts";

// Load environment variables from .env file
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

if (["1", "true"].includes((process.env.TRUST_PROXY || "").toLowerCase())) {
  app.set("trust proxy", 1);
}

// next add security middlewares/headers + make sure to listen on *root file* for changes

app.use(helmet()); // Security middleware to set various HTTP headers for app security
app.use(express.json({ limit: "5mb" })); // Parse JSON payloads (logo uploads are base64)
app.use(express.urlencoded({ extended: true, limit: "5mb" })); // Middleware to parse URL-encoded bodies
app.use(cookieParser()); // Middleware to parse cookies

// log http requests to console
// NODE_ENV missing in .env
if (process.env.STAGE === "development") {
  app.use(morgan("dev"));
}

// cross-origin resource sharing (CORS) middleware

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

// health check route
app.get("/", (req: Request, res: Response) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  res.status(200).json({ status: "OK", message: "Server is healthy" });
});

// SPA Fallback: serve index.html for all non-API routes (enables SPA routing on direct links)
// Note: Build frontend first (cd frontend && bun run build), then use NODE_ENV=production
const staticPath = process.env.STATIC_PATH || join(process.cwd(), "..", "frontend", "dist");
const enableFallback = process.env.NODE_ENV === "production" || process.env.ENABLE_SPA_FALLBACK === "true";

if (enableFallback && existsSync(staticPath)) {
  app.use(express.static(staticPath, {
    setHeaders: (res) => {
      res.setHeader("ngrok-skip-browser-warning", "true");
    },
  }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/socket.io") && !req.path.includes(".")) {
      const indexPath = join(staticPath, "index.html");
      if (existsSync(indexPath)) {
        res.setHeader("Content-Type", "text/html");
        res.setHeader("ngrok-skip-browser-warning", "true");
        res.send(readFileSync(indexPath, "utf-8"));
        return;
      }
    }
    next();
  });
}

// ✅ Routes publiques (sans auth)
app.use("/api/public", publicRouter);

// ✅ MULTI-TENANT: Master Admin routes (before other routes)
app.use("/api/master", masterAdminRouter);
app.use("/api/onboarding", schoolOnboardingRouter);

// import user routes
app.use("/api/users", userRoutes);
app.use("/api/activities", LogsRouter);
app.use("/api/academic-years", academicYearRouter);
app.use("/api/classes", classRouter);
app.use("/api/subjects", subjectRouter);
app.use("/api/timetables", timeRouter);
app.use("/api/exams", examRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/search", searchRouter);
app.use("/api/report-cards", reportCardRouter);
app.use("/api/email-logs", emailLogRouter);
app.use("/api/parent", parentRouter);
app.use("/api/finance", financeRouter);
app.use("/api/ai", aiRouter);
app.use("/api/school-settings", schoolSettingsRouter);
app.use("/api/core-domain", coreDomainRouter);
app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [
      generateTimeTable,
      generateExam,
      handleExamSubmission,
      generateReportCards,
    ],
  })
);

// global error handler middleware
app.use((err: Error, req: Request, res: Response, next: Function) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

initSocket(httpServer, clientUrl);
httpServer.listen(PORT, () => {
  console.log("Server is running on port 5000");
});
// you can use any of these scripts in your package.json to run the server with nodemon or bun
//    "dev" : "nodemon --exec bun run index.ts",
// "start": "bun --watch index.ts"

// if it's the first time you will redirect to create a new project. The page we are now