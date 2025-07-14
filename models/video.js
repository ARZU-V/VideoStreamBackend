import mongoose from "mongoose";

const videoSchema = new mongoose.Schema({
  title: String,
  description: String,
  videoPath: String,
  imagePath: String,
  videoUrl: String,
  imageUrl: String,
  videoId: String,
  imageId: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Video || mongoose.model("Video", videoSchema);
