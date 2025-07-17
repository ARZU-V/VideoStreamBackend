import fs from "fs";
import os from "os";
import path from "path";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import Video from "../models/video.js";
import bucket from "../config/gcs.js";
import multer from "multer";
import { Storage } from "@google-cloud/storage";

const upload = multer({ storage: multer.memoryStorage() });

export async function getSignedUrl(req, res) {
  const { filePath } = req.query; // e.g., 'images/filename.jpg' or 'videos/hls/uuid/index.m3u8'
  if (!filePath) return res.status(400).json({ error: "filePath is required" });

  const options = {
    version: "v4",
    action: "read",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  };

  try {
    const [url] = await bucket.file(filePath).getSignedUrl(options);
    res.json({ url });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to generate signed URL", details: err });
  }
}

export const uploadVideo = [
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    console.log("=== UPLOAD VIDEO REQUEST START ===");
    console.log("Request body:", req.body);
    console.log(
      "Request files:",
      req.files ? Object.keys(req.files) : "No files"
    );

    try {
      if (!req.files || !req.files.video || !req.files.image) {
        console.error("Missing video or image file:", req.files);
        return res
          .status(400)
          .json({ error: "Both video and image files are required." });
      }

      const videoFile = req.files.video[0];
      const imageFile = req.files.image[0];
      const { title, description } = req.body;

      console.log("Video file:", {
        originalname: videoFile.originalname,
        mimetype: videoFile.mimetype,
        size: videoFile.size,
      });
      console.log("Image file:", {
        originalname: imageFile.originalname,
        mimetype: imageFile.mimetype,
        size: imageFile.size,
      });
      console.log("Title:", title, "Description:", description);

      const videoId = uuidv4();
      console.log("Generated video ID:", videoId);

      // 1. Upload image to GCS
      console.log("=== STEP 1: Uploading image to GCS ===");
      const imageBlob = bucket.file(
        "images/" + Date.now() + "-" + imageFile.originalname
      );
      const imageStream = imageBlob.createWriteStream({
        resumable: false,
        contentType: imageFile.mimetype,
      });
      await new Promise((resolve, reject) => {
        imageStream.on("error", (error) => {
          console.error("Image upload error:", error);
          reject(error);
        });
        imageStream.on("finish", () => {
          console.log("Image upload finished successfully");
          resolve();
        });
        imageStream.end(imageFile.buffer);
      });
      const imageUrl = `https://storage.googleapis.com/${bucket.name}/${imageBlob.name}`;
      console.log("Image uploaded to:", imageUrl);

      // 2. Save original video to temp file
      console.log("=== STEP 2: Saving video to temp file ===");
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hls-"));
      const tempVideoPath = path.join(tempDir, videoFile.originalname);
      fs.writeFileSync(tempVideoPath, videoFile.buffer);
      console.log("Video saved to temp path:", tempVideoPath);

      // 3. Convert video to adaptive bitrate HLS with FFmpeg
      console.log("=== STEP 3: Converting video to adaptive bitrate HLS ===");
      const hlsOutputDir = path.join(tempDir, "hls");
      fs.mkdirSync(hlsOutputDir);
      const masterPlaylist = path.join(hlsOutputDir, "index.m3u8");
      // Use ffmpeg-static path for Render deployment
      const ffmpegPath =
        process.env.NODE_ENV === "production"
          ? "./node_modules/ffmpeg-static/ffmpeg"
          : "ffmpeg";
      // Adaptive bitrate renditions: 1080p, 720p, 480p, 360p
      const ffmpegCmd = `"${ffmpegPath}" -i "${tempVideoPath}" \
        -filter_complex "[0:v]split=4[v1][v2][v3][v4]; \
          [v1]scale=w=1920:h=1080[v1out]; \
          [v2]scale=w=1280:h=720[v2out]; \
          [v3]scale=w=854:h=480[v3out]; \
          [v4]scale=w=426:h=240[v4out]" \
        -map "[v1out]" -c:v:0 libx264 -b:v:0 5000k -preset veryfast -g 48 -sc_threshold 0 \
        -map "[v2out]" -c:v:1 libx264 -b:v:1 3000k -preset veryfast -g 48 -sc_threshold 0 \
        -map "[v3out]" -c:v:2 libx264 -b:v:2 1200k -preset veryfast -g 48 -sc_threshold 0 \
        -map "[v4out]" -c:v:3 libx264 -b:v:3 400k -preset veryfast -g 48 -sc_threshold 0 \
        -map a:0 -c:a:0 aac -b:a:0 192k \
        -map a:0 -c:a:1 aac -b:a:1 128k \
        -map a:0 -c:a:2 aac -b:a:2 96k \
        -map a:0 -c:a:3 aac -b:a:3 64k \
        -f hls -hls_time 6 -hls_playlist_type vod \
        -hls_segment_filename \"${hlsOutputDir}/v%v/segment_%03d.ts\" \
        -master_pl_name index.m3u8 \
        -var_stream_map \"v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3\" \
        \"${hlsOutputDir}/v%v/index.m3u8\"`;
      console.log("Running FFmpeg command:", ffmpegCmd);
      await new Promise((resolve, reject) => {
        exec(ffmpegCmd, (err, stdout, stderr) => {
          if (err) {
            console.error("FFmpeg error:", err);
            console.error("FFmpeg stderr:", stderr);
            reject(err);
          } else {
            console.log("FFmpeg conversion completed successfully");
            console.log("FFmpeg stdout:", stdout);
            resolve();
          }
        });
      });

      // 4. Recursively upload HLS output to GCS
      console.log("=== STEP 4: Uploading HLS files to GCS ===");
      function walkDir(dir, fileList = [], relPath = "") {
        const files = fs.readdirSync(dir);
        files.forEach((file) => {
          const filePath = path.join(dir, file);
          const relFilePath = path.join(relPath, file);
          if (fs.statSync(filePath).isDirectory()) {
            walkDir(filePath, fileList, relFilePath);
          } else {
            fileList.push({ abs: filePath, rel: relFilePath });
          }
        });
        return fileList;
      }
      const hlsFiles = walkDir(hlsOutputDir);
      console.log(
        "HLS files to upload:",
        hlsFiles.map((f) => f.rel)
      );
      for (const file of hlsFiles) {
        const gcsPath = `videos/hls/${videoId}/${file.rel.replace(/\\/g, "/")}`;
        console.log("Uploading file:", file.abs, "to GCS path:", gcsPath);
        await bucket.upload(file.abs, { destination: gcsPath });
        console.log("Uploaded HLS file to GCS:", gcsPath);
      }
      const hlsUrl = `https://storage.googleapis.com/${bucket.name}/videos/hls/${videoId}/index.m3u8`;
      console.log("Final HLS master playlist URL:", hlsUrl);

      // 5. Save metadata to MongoDB
      console.log("=== STEP 5: Saving to MongoDB ===");
      const video = new Video({
        title,
        description,
        videoUrl: hlsUrl,
        imageUrl,
        uploadedBy: req.user?.id || null,
      });
      await video.save();
      console.log("Video saved to MongoDB with ID:", video._id);

      // 6. Clean up temp files
      console.log("=== STEP 6: Cleaning up temp files ===");
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log("Temp files cleaned up");

      console.log("=== UPLOAD COMPLETED SUCCESSFULLY ===");
      return res.status(200).json({ videoUrl: hlsUrl, imageUrl, video });
    } catch (err) {
      console.error("=== UPLOAD ERROR ===");
      console.error("Error type:", err.constructor.name);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
      console.error("Full error object:", err);
      return res.status(500).json({
        error: "Failed to process and upload video",
        details: err.message,
      });
    }
  },
];

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
    console.log("getAllVideos called");
    const videos = await Video.find(
      {},
      "title imageUrl videoUrl description createdAt"
    ).sort({ createdAt: -1 });
    console.log("Videos fetched from MongoDB:", videos);

    // Only include videos with valid GCS URLs
    const formatted = videos
      .filter((v) => v.imageUrl && v.videoUrl)
      .map((v) => ({
        title: v.title,
        imageUrl: v.imageUrl,
        videoUrl: v.videoUrl,
        description: v.description,
        createdAt: v.createdAt,
        _id: v._id,
      }));

    res.status(200).json(formatted);
  } catch (error) {
    console.error("Error in getAllVideos:", error);
    res.status(500).json({ error: "Failed to fetch videos", details: error });
  }
};
