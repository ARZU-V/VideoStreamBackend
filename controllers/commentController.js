import Comment from "../models/comment.js";
import Video from "../models/video.js";
import User from "../models/user.js";

// Get comments for a video
export const getComments = async (req, res) => {
  try {
    const { videoId } = req.params;
    const comments = await Comment.find({ video: videoId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(comments); // Always return 200 with array
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch comments" });
  }
};

// Post a new comment
export const postComment = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Comment text required" });
    let username = "Anonymous";
    if (req.user && req.user.id) {
      console.log("Looking up user for comment:", req.user.id);
      const userDoc = await User.findById(req.user.id).lean();
      console.log("User doc found:", userDoc);
      if (userDoc && userDoc.username) {
        username = userDoc.username;
      }
    }
    const comment = new Comment({
      video: videoId,
      user: req.user?.id,
      username,
      text,
    });
    await comment.save();
    res.status(201).json(comment);
  } catch (err) {
    console.error("Error posting comment:", err);
    res.status(500).json({ error: "Failed to post comment" });
  }
};
