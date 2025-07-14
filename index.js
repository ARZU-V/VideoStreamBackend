import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import videoRoutes from "./routes/videoRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
connectDB();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Serve static files (HLS + thumbnails)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Routes
app.use("/api/videos", videoRoutes);
app.use("/api/auth", authRoutes);

// Basic route
app.get("/", (req, res) => res.send("Video Streaming Backend Running"));

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
