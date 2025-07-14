import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import Video from "../models/video.js";
import { v4 as uuidv4 } from "uuid";

// Support __dirname with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Upload video and convert to HLS format using FFmpeg
 */
export const uploadVideo = async (req, res) => {
  try {
    const { title, description } = req.body;
    const files = req.files;

    console.log("Request Body:", req.body); // Add this line to check the request body
    console.log("Request Files:", req.files); // Add this line to check the uploaded files

    const videoFile = files?.video?.[0];
    const imageFile = files?.image?.[0];

    if (!title) return res.status(400).json({ error: "Title is required" });
    if (!videoFile)
      return res.status(400).json({ error: "No video file uploaded" });
    if (!imageFile)
      return res.status(400).json({ error: "No image file uploaded" });
    const videoId = uuidv4();
    const imageId = uuidv4();

    const videoOutputPath = path.join(
      __dirname,
      "../uploads/video/slots",
      videoId
    );
    const imageOutputPath = path.join(__dirname, "../uploads/images");

    fs.mkdirSync(videoOutputPath, { recursive: true });
    fs.mkdirSync(imageOutputPath, { recursive: true });

    const hlsPath = path.join(videoOutputPath, "index.m3u8");

    const ffmpegCommand = `ffmpeg -i "${videoFile.path}" \
-codec:v libx264 -preset ultrafast -crf 28 \
-codec:a aac -b:a 64k \
-hls_time 30 -hls_playlist_type vod \
-hls_segment_filename "${videoOutputPath}/segment%03d.ts" \
-threads 2 \
-start_number 0 \
"${hlsPath}"`;

    exec(ffmpegCommand, async (error) => {
      if (error) {
        console.error("FFmpeg error:", error.message);
        return res.status(500).json({ error: "Video processing failed" });
      }

      try {
        fs.unlinkSync(videoFile.path);
        const imageExtension = path.extname(imageFile.originalname);
        const renamedImagePath = path.join(
          imageOutputPath,
          `${imageId}${imageExtension}`
        );
        fs.renameSync(imageFile.path, renamedImagePath);

        const video = new Video({
          title,
          description,
          videoPath: hlsPath,
          imagePath: renamedImagePath,
          videoId,
          imageId,
          uploadedBy: req.user.id, // Add user ID to video
        });

        await video.save();

        res.status(201).json({
          message: "Video and image uploaded successfully",
          videoUrl: `/uploads/video/slots/${videoId}/index.m3u8`,
          imageUrl: `/uploads/images/${imageId}${imageExtension}`,
          video,
        });
      } catch (dbError) {
        console.error("Database error:", dbError.message);
        res.status(500).json({ error: "Failed to save video details" });
      }
    });
  } catch (error) {
    console.error("Upload error:", error.message);
    res.status(500).json({ error: "Video upload failed" });
  }
};

/**
 * Stream HLS video or TS segments
 */
export const streamVideo = async (req, res) => {
  try {
    const { id, file } = req.params;
    const hlsFolderPath = path.join(__dirname, "../uploads/video/slots", id);
    const filePath = path.join(hlsFolderPath, file);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `File not found: ${filePath}` });
    }

    if (file.endsWith(".m3u8")) {
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.sendFile(filePath);
    }

    if (file.endsWith(".ts")) {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          return res
            .status(416)
            .send(
              `Requested range not satisfiable\n${start}-${end}/${fileSize}`
            );
        }

        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "video/MP2T",
        });

        stream.pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": "video/MP2T",
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } else {
      res.status(400).json({ error: "Unsupported file type" });
    }
  } catch (error) {
    console.error("Stream error:", error.message);
    res.status(500).json({ error: "Error streaming video" });
  }
};

/**
 * Get all videos for homepage (title + thumbnail + ID)
 */
export const getAllVideos = async (req, res) => {
  try {
    const videos = await Video.find(
      {},
      "title imagePath videoId description"
    ).sort({
      createdAt: -1,
    });

    console.log("Videos from DB:", videos); // Add this line to log the raw data from the database

    const formatted = videos.map((v) => ({
      title: v.title,
      imageUrl: `/uploads/images/${path.basename(v.imagePath)}`,
      videoId: v.videoId,
      description: v.description,
    }));

    console.log("Formatted Videos:", formatted); // Add this line to log the formatted data

    res.status(200).json({ videos: formatted });
  } catch (error) {
    console.error("Error fetching videos:", error.message);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
};
