// server/testLiveAPI.js
// Test script to manually test live stream API endpoints

import fs from "fs";
import path from "path";

console.log("Testing Live Stream API...");

// Test 1: Check if live directory exists
const liveDir = path.join(process.cwd(), "uploads", "live");
console.log("Live directory path:", liveDir);

if (fs.existsSync(liveDir)) {
  console.log("✅ Live directory exists");

  // Test 2: List all stream directories
  const streamIds = fs.readdirSync(liveDir);
  console.log("Found stream directories:", streamIds);

  // Test 3: Check each stream for HLS files
  streamIds.forEach((streamId) => {
    const streamDir = path.join(liveDir, streamId);
    const playlistPath = path.join(streamDir, "index.m3u8");
    const segmentPath = path.join(streamDir, "segment_000.ts");

    console.log(`\nStream ${streamId}:`);
    console.log(`  Directory exists: ${fs.existsSync(streamDir)}`);
    console.log(`  Playlist exists: ${fs.existsSync(playlistPath)}`);
    console.log(`  Segment exists: ${fs.existsSync(segmentPath)}`);

    if (fs.existsSync(streamDir)) {
      const files = fs.readdirSync(streamDir);
      console.log(`  All files: ${files.join(", ")}`);
    }
  });
} else {
  console.log("❌ Live directory does not exist");

  // Create test directory structure
  console.log("Creating test directory structure...");
  fs.mkdirSync(liveDir, { recursive: true });

  // Create a test stream
  const testStreamId = Date.now().toString();
  const testStreamDir = path.join(liveDir, testStreamId);
  fs.mkdirSync(testStreamDir, { recursive: true });

  // Create a test HLS playlist
  const testPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:2.0,
segment_000.ts
#EXT-X-ENDLIST`;

  fs.writeFileSync(path.join(testStreamDir, "index.m3u8"), testPlaylist);
  fs.writeFileSync(
    path.join(testStreamDir, "segment_000.ts"),
    "test segment data"
  );

  console.log(`✅ Created test stream: ${testStreamId}`);
}

console.log("\nTest completed!");
