// server/simpleTest.js
// Simple test to check FFmpeg basic functionality

import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegPath);

console.log("FFmpeg path:", ffmpegPath);
console.log("Testing basic FFmpeg functionality...");

// Check if FFmpeg executable exists
if (fs.existsSync(ffmpegPath)) {
  console.log("✅ FFmpeg executable found");
} else {
  console.log("❌ FFmpeg executable not found");
}

// Simple test - just check if FFmpeg can be called
ffmpeg()
  .input("testsrc=duration=1:size=320x240:rate=1")
  .output("test_output.mp4")
  .on("start", (commandLine) => {
    console.log("✅ FFmpeg command started:", commandLine);
  })
  .on("end", () => {
    console.log("✅ FFmpeg test completed successfully");
    if (fs.existsSync("test_output.mp4")) {
      console.log("✅ Output file created");
      fs.unlinkSync("test_output.mp4"); // Clean up
    }
  })
  .on("error", (err) => {
    console.error("❌ FFmpeg error:", err);
  })
  .run();
