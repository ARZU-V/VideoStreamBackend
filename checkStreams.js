// server/checkStreams.js
// Simple script to check live stream directories

import fs from "fs";
import path from "path";

const liveDir = path.join(process.cwd(), "uploads", "live");
console.log("Checking live streams in:", liveDir);

if (fs.existsSync(liveDir)) {
  const streamIds = fs.readdirSync(liveDir);
  console.log("Found stream directories:", streamIds);

  streamIds.forEach((streamId) => {
    const streamDir = path.join(liveDir, streamId);
    console.log(`\nStream ${streamId}:`);

    if (fs.existsSync(streamDir)) {
      const files = fs.readdirSync(streamDir);
      console.log(`  Files: ${files.join(", ")}`);

      const hasPlaylist = files.includes("index.m3u8");
      const hasSegments = files.some((f) => f.endsWith(".ts"));
      const hasInput = files.includes("input.webm");

      console.log(`  Has playlist: ${hasPlaylist}`);
      console.log(`  Has segments: ${hasSegments}`);
      console.log(`  Has input file: ${hasInput}`);
    }
  });
} else {
  console.log("Live directory does not exist");
}
