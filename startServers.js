// server/startServers.js
// Script to start both the main server and live stream server

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🚀 Starting Video Streaming Servers...");
console.log("📡 Main server will run on port 4000");
console.log("🎥 Live stream server will run on port 8081");

// Start the main server
const mainServer = spawn("node", ["index.js"], {
  cwd: __dirname,
  stdio: "inherit",
});

// Start the live stream server
const liveServer = spawn("node", ["liveStreamServer.js"], {
  cwd: __dirname,
  stdio: "inherit",
});

// Handle process termination
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down servers...");
  mainServer.kill();
  liveServer.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down servers...");
  mainServer.kill();
  liveServer.kill();
  process.exit(0);
});

console.log("✅ Both servers are starting...");
console.log("🌐 Main API: http://localhost:4000");
console.log("📺 Live Streams: ws://localhost:8081");
console.log(
  "📱 Frontend: http://localhost:5173 (run 'cd client && npm run dev')"
);
