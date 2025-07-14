import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import videoRoutes from "./routes/videoRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import liveRoutes from "./routes/liveRoutes.js";
import path from "path";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

import { fileURLToPath } from "url";

dotenv.config();
connectDB();

const app = express();
const server = createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Serve static files (HLS + thumbnails)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Routes
app.use("/api/videos", videoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/live", liveRoutes);

// Basic route
app.get("/", (req, res) => res.send("Video Streaming Backend Running"));

// WebSocket server for live streaming (on the same server)
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Live stream client connected");

  // Create a unique stream directory for this session
  const streamId = Date.now().toString();
  const streamDir = path.join(process.cwd(), "uploads", "live", streamId);
  fs.mkdirSync(streamDir, { recursive: true });

  console.log(`Creating FFmpeg process for stream ${streamId}`);
  console.log(`Stream directory: ${streamDir}`);

  // Start FFmpeg process with optimized settings for low latency
  const ffmpegArgs = [
    "-f",
    "webm",
    "-i",
    "pipe:0", // Read from stdin
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-f",
    "hls",
    "-hls_time",
    "1", // Reduced from 2 to 1 second for lower latency
    "-hls_list_size",
    "3", // Reduced from 5 to 3 segments
    "-hls_flags",
    "delete_segments+append_list", // Better for live streaming
    "-hls_segment_filename",
    path.join(streamDir, "segment_%03d.ts"),
    "-preset",
    "ultrafast", // Fastest encoding preset
    "-crf",
    "28", // Slightly lower quality for faster encoding
    "-g",
    "30", // Keyframe interval
    "-sc_threshold",
    "0", // Disable scene change detection
    "-tune",
    "zerolatency", // Optimize for low latency
    "-fflags",
    "+genpts", // Generate presentation timestamps
    path.join(streamDir, "index.m3u8"),
  ];

  console.log("Starting FFmpeg with low-latency settings:", ffmpegArgs);
  console.log("FFmpeg path:", ffmpegPath);

  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  ffmpegProcess.stdout.on("data", (data) => {
    console.log("FFmpeg stdout:", data.toString());
  });

  ffmpegProcess.stderr.on("data", (data) => {
    console.log("FFmpeg stderr:", data.toString());
  });

  ffmpegProcess.on("error", (error) => {
    console.error("FFmpeg process error:", error);
  });

  ffmpegProcess.on("close", (code) => {
    console.log(`FFmpeg process exited with code ${code}`);
  });

  // Wait a moment for FFmpeg to start
  setTimeout(() => {
    console.log("FFmpeg process should be ready now");
  }, 1000); // Reduced from 2000ms to 1000ms

  ws.on("message", (data) => {
    try {
      // Send data directly to FFmpeg stdin
      if (ffmpegProcess && !ffmpegProcess.killed) {
        ffmpegProcess.stdin.write(data);
      }
    } catch (err) {
      console.error("Error writing to FFmpeg:", err);
    }
  });

  ws.on("close", () => {
    console.log("Live stream client disconnected");
    if (ffmpegProcess && !ffmpegProcess.killed) {
      ffmpegProcess.stdin.end();
      ffmpegProcess.kill();
    }
  });
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(
    `📺 Live streaming WebSocket available on ws://localhost:${PORT}`
  );
});
