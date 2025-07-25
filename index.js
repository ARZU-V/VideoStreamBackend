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
import "./models/comment.js";

dotenv.config();
connectDB();

const app = express();
const server = createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enhanced CORS configuration for mobile compatibility
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [
            "https://streamitbroski.vercel.app",
            "https://your-frontend-domain.com",
            "http://localhost:5173",
            "http://localhost:3000",
          ]
        : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Range", "Accept-Ranges"],
    exposedHeaders: ["Content-Range", "Accept-Ranges", "Content-Length"],
  })
);

// Add mobile-friendly headers middleware
app.use((req, res, next) => {
  // Enable CORS for video streaming
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Range, Authorization"
  );

  // Mobile-specific headers for video streaming
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-Frame-Options", "SAMEORIGIN");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// In-memory store for live stream metadata
const liveStreams = {};

// Serve static files (HLS + thumbnails)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads/live", express.static(path.join(__dirname, "uploads/live")));

// API Routes
app.use("/api/videos", videoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/live", liveRoutes);

// Add/replace liveRoutes active endpoint to include stream names
app.get("/api/live/active", (req, res) => {
  // Only include streams with a valid playlist
  const streams = Object.values(liveStreams)
    .filter((s) => {
      const playlistPath = path.join(
        process.cwd(),
        "uploads",
        "live",
        s.streamId,
        "index.m3u8"
      );
      return fs.existsSync(playlistPath);
    })
    .map((s) => ({
      streamId: s.streamId,
      name: s.name,
      startedAt: s.startedAt,
      playlistUrl: `/api/live/stream/${s.streamId}/index.m3u8`,
    }));
  res.json({ streams });
});

// Basic route
app.get("/", (req, res) => res.send("Video Streaming Backend Running"));

// WebSocket server for live streaming (on the same server)
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Live stream client connected");

  let streamId = Date.now().toString();
  let streamName = "Untitled Stream";
  let streamDir = path.join(process.cwd(), "uploads", "live", streamId);
  let ffmpegProcess = null;
  let startedAt = new Date().toISOString();
  let firstMessage = true;

  ws.on("message", (data) => {
    if (firstMessage) {
      // Expect first message to be JSON with stream name
      try {
        const msg = JSON.parse(data.toString());
        if (msg && msg.name) {
          streamName = msg.name;
        }
      } catch (e) {
        // Not JSON, ignore
      }
      // Create stream dir and start FFmpeg after receiving name
      fs.mkdirSync(streamDir, { recursive: true });
      console.log(
        `Creating FFmpeg process for stream ${streamId} (${streamName})`
      );
      console.log(`Stream directory: ${streamDir}`);
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
        "3",
        "-hls_list_size",
        "8",
        "-hls_flags",
        "delete_segments+append_list+independent_segments+temp_file",
        "-hls_segment_filename",
        path.join(streamDir, "segment_%03d.ts"),
        "-preset",
        "ultrafast",
        "-crf",
        "28",
        "-g",
        "90",
        "-sc_threshold",
        "0",
        "-tune",
        "zerolatency",
        "-fflags",
        "+genpts",
        path.join(streamDir, "index.m3u8"),
      ];
      ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
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
      if (ffmpegProcess.stdin) {
        ffmpegProcess.stdin.on("error", (err) => {
          console.error("FFmpeg stdin error:", err);
        });
      }
      // Store stream metadata
      liveStreams[streamId] = { streamId, name: streamName, startedAt };
      firstMessage = false;
      return;
    }
    // Write video data to FFmpeg
    try {
      if (
        ffmpegProcess &&
        !ffmpegProcess.killed &&
        ffmpegProcess.stdin &&
        !ffmpegProcess.stdin.destroyed
      ) {
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
    // Remove stream metadata
    delete liveStreams[streamId];
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
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
