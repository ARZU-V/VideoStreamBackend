import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Get list of active live streams
router.get("/active", (req, res) => {
  try {
    const liveDir = path.join(process.cwd(), "uploads", "live");
    console.log("Looking for live streams in:", liveDir);

    if (!fs.existsSync(liveDir)) {
      console.log("Live directory does not exist");
      return res.json({ streams: [] });
    }

    const streamIds = fs.readdirSync(liveDir);
    console.log("Found stream directories:", streamIds);

    const streams = streamIds
      .filter((streamId) => {
        // Check if stream has a valid HLS playlist
        const playlistPath = path.join(liveDir, streamId, "index.m3u8");
        const exists = fs.existsSync(playlistPath);
        console.log(`Stream ${streamId}: playlist exists = ${exists}`);
        return exists;
      })
      .map((streamId) => {
        const streamInfo = {
          streamId,
          startedAt: new Date(parseInt(streamId)).toISOString(),
          playlistUrl: `/api/live/stream/${streamId}/index.m3u8`,
        };
        console.log("Adding stream:", streamInfo);
        return streamInfo;
      });

    console.log("Returning streams:", streams);
    res.json({ streams });
  } catch (error) {
    console.error("Error getting active streams:", error);
    res.status(500).json({ error: "Failed to get active streams" });
  }
});

// Serve live stream HLS content
router.get("/stream/:streamId/:file", (req, res) => {
  try {
    const { streamId, file } = req.params;
    const liveDir = path.join(process.cwd(), "uploads", "live", streamId);
    const filePath = path.join(liveDir, file);

    console.log(`Serving live stream file: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return res.status(404).json({ error: "Stream not found" });
    }

    // Set appropriate headers for HLS content
    if (file.endsWith(".m3u8")) {
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Cache-Control", "no-cache");
    } else if (file.endsWith(".ts")) {
      res.setHeader("Content-Type", "video/MP2T");
      res.setHeader("Cache-Control", "no-cache");
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error("Error serving live stream:", error);
    res.status(500).json({ error: "Failed to serve live stream" });
  }
});

export default router;
