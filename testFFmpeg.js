// server/testFFmpeg.js
// Test script to verify FFmpeg installation and functionality

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import ffmpegPath from "ffmpeg-static";

console.log("Testing FFmpeg installation...");
console.log("FFmpeg path:", ffmpegPath);

// Test 1: Check if FFmpeg is available
try {
  const testProcess = spawn(ffmpegPath, ["-version"]);

  testProcess.stdout.on("data", (data) => {
    console.log("FFmpeg version:", data.toString().split("\n")[0]);
  });

  testProcess.stderr.on("data", (data) => {
    console.log("FFmpeg stderr:", data.toString());
  });

  testProcess.on("close", (code) => {
    if (code === 0) {
      console.log("✓ FFmpeg is working correctly!");

      // Test 2: Check available formats
      const formatsProcess = spawn(ffmpegPath, ["-formats"]);
      let formatOutput = "";

      formatsProcess.stdout.on("data", (data) => {
        formatOutput += data.toString();
      });

      formatsProcess.on("close", (code) => {
        const webmSupported = formatOutput.includes("webm");
        const hlsSupported = formatOutput.includes("hls");

        console.log(`✓ WebM format supported: ${webmSupported}`);
        console.log(`✓ HLS format supported: ${hlsSupported}`);

        // Test 3: Create a simple test stream
        testHLSGeneration();
      });
    } else {
      console.log("✗ FFmpeg test failed with code:", code);
    }
  });
} catch (error) {
  console.error("Error testing FFmpeg:", error);
}

function testHLSGeneration() {
  console.log("\nTesting HLS generation...");

  const testDir = path.join(process.cwd(), "uploads", "test");
  fs.mkdirSync(testDir, { recursive: true });

  // Create a simple test video using FFmpeg's built-in test sources
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
    "2",
    "-hls_list_size",
    "5",
    "-hls_flags",
    "delete_segments",
    "-hls_segment_filename",
    path.join(testDir, "segment_%03d.ts"),
    path.join(testDir, "index.m3u8"),
  ];

  console.log("Test FFmpeg command:", ffmpegPath, ffmpegArgs.join(" "));

  const testProcess = spawn(ffmpegPath, ffmpegArgs);

  testProcess.stdout.on("data", (data) => {
    console.log("Test stdout:", data.toString());
  });

  testProcess.stderr.on("data", (data) => {
    console.log("Test stderr:", data.toString());
  });

  testProcess.on("close", (code) => {
    if (code === 0) {
      console.log("✓ HLS generation test successful!");

      // Check if files were created
      setTimeout(() => {
        const files = fs.readdirSync(testDir);
        console.log("Created files:", files);

        const hasPlaylist = files.includes("index.m3u8");
        const hasSegments = files.some((f) => f.endsWith(".ts"));

        console.log(`✓ Playlist created: ${hasPlaylist}`);
        console.log(`✓ Segments created: ${hasSegments}`);

        if (hasPlaylist && hasSegments) {
          console.log(
            "✓ All tests passed! FFmpeg is ready for live streaming."
          );
        } else {
          console.log("✗ Some files were not created properly.");
        }
      }, 1000);
    } else {
      console.log("✗ HLS generation test failed with code:", code);
    }
  });
}
