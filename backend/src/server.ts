// let create a simple server
import cookieParser from "cookie-parser";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import cors from "cors";

import { connectDB } from "./config/db.ts";
import userRoutes from "./routes/user.ts";
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
} from "./inngest/functions.ts";
import timeRouter from "./routes/timetable.ts";
import examRouter from "./routes/exam.ts";
import dashboardRouter from "./routes/dashboard.ts";
import attendanceRouter from "./routes/attendance.ts";
import searchRouter from "./routes/search.ts";

// Load environment variables from .env file
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// next add security middlewares/headers + make sure to listen on *root file* for changes

app.use(helmet()); // Security middleware to set various HTTP headers for app security
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded bodies
app.use(cookieParser()); // Middleware to parse cookies

// log http requests to console
// NODE_ENV missing in .env
if (process.env.STAGE === "development") {
  app.use(morgan("dev"));
}

// cross-origin resource sharing (CORS) middleware
// credentials: true allows cookies to be sent with requests
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// health check route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK", message: "Server is healthy" });
});

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
app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [generateTimeTable, generateExam, handleExamSubmission],
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

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log("Server is running on port 5000");
  });
});
// you can use any of these scripts in your package.json to run the server with nodemon or bun
//    "dev" : "nodemon --exec bun run index.ts",
// "start": "bun --watch index.ts"

// if it's the first time you will redirect to create a new project. The page we are now