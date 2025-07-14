// server/testLowLatency.js
// Test script to verify low-latency FFmpeg settings

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import ffmpegPath from "ffmpeg-static";

console.log("Testing low-latency FFmpeg settings...");

const testDir = path.join(process.cwd(), "uploads", "test-lowlatency");
fs.mkdirSync(testDir, { recursive: true });

// Use the same settings as the live stream server
const ffmpegArgs = [
  "-f",
  "lavfi",
  "-i",
  "testsrc=duration=5:size=320x240:rate=1",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=1000:duration=5",
  "-c:v",
  "libx264",
  "-c:a",
  "aac",
  "-f",
  "hls",
  "-hls_time",
  "1", // 1 second segments for low latency
  "-hls_list_size",
  "3", // Only 3 segments
  "-hls_flags",
  "delete_segments+append_list",
  "-hls_segment_filename",
  path.join(testDir, "segment_%03d.ts"),
  "-preset",
  "ultrafast",
  "-crf",
  "28",
  "-g",
  "30",
  "-sc_threshold",
  "0",
  "-tune",
  "zerolatency",
  "-fflags",
  "+genpts",
  path.join(testDir, "index.m3u8"),
];

console.log("Test command:", ffmpegPath, ffmpegArgs.join(" "));

const testProcess = spawn(ffmpegPath, ffmpegArgs);

testProcess.stdout.on("data", (data) => {
  console.log("Test stdout:", data.toString());
});

testProcess.stderr.on("data", (data) => {
  console.log("Test stderr:", data.toString());
});

testProcess.on("close", (code) => {
  if (code === 0) {
    console.log("✓ Low-latency test successful!");

    setTimeout(() => {
      const files = fs.readdirSync(testDir);
      console.log("Created files:", files);

      const hasPlaylist = files.includes("index.m3u8");
      const hasSegments = files.some((f) => f.endsWith(".ts"));
      const segmentCount = files.filter((f) => f.endsWith(".ts")).length;

      console.log(`✓ Playlist created: ${hasPlaylist}`);
      console.log(
        `✓ Segments created: ${hasSegments} (${segmentCount} segments)`
      );

      if (hasPlaylist && hasSegments) {
        console.log("✓ Low-latency settings are working correctly!");
        console.log(
          "Expected latency: ~2-3 seconds (1s segment + 1-2s processing)"
        );
      }
    }, 1000);
  } else {
    console.log("✗ Low-latency test failed with code:", code);
  }
});
