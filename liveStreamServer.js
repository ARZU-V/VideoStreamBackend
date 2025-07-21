// server/liveStreamServer.js
// WebSocket server for browser-based live streaming

import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

const wss = new WebSocketServer({ port: 8081 }); // Use a separate port for live streaming

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
    "3", // Increased from 2 to 3 seconds for more stable segments
    "-hls_list_size",
    "8", // Increased from 6 to 8 segments for better buffering
    "-hls_flags",
    "delete_segments+append_list+independent_segments+temp_file", // Add temp_file for atomic segment writing
    "-hls_segment_filename",
    path.join(streamDir, "segment_%03d.ts"),
    "-preset",
    "ultrafast", // Fastest encoding preset
    "-crf",
    "28", // Slightly lower quality for faster encoding
    "-g",
    "90", // Keyframe interval: 30fps x 3s = 90
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

console.log("Live streaming WebSocket server running on ws://localhost:8081");
