import express from "express";
import multer from "multer";
import {
  uploadVideo,
  streamVideo,
  getAllVideos,
  getSignedUrl,
} from "../controllers/videoController.js";
import { getComments, postComment } from "../controllers/commentController.js";
import { protect } from "../middlewares/auth.js";

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directories exist
const videoDir = path.join(__dirname, "../uploads/videos");
const imageDir = path.join(__dirname, "../uploads/images");
[videoDir, imageDir].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "video") cb(null, videoDir);
    else if (file.fieldname === "image") cb(null, imageDir);
    else cb(new Error("Invalid field name"));
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage }).fields([
  { name: "video", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

const router = express.Router();
router.get("/allvideo", getAllVideos);
router.post("/upload", uploadVideo);
router.get("/stream/:id/:file", streamVideo);
router.get("/signed-url", getSignedUrl);

// Comments API
router.get("/:videoId/comments", getComments);
router.post("/:videoId/comments", protect, postComment);

export default router;
