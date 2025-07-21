import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
  video: { type: mongoose.Schema.Types.ObjectId, ref: "Video", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  username: { type: String },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Comment", commentSchema);
