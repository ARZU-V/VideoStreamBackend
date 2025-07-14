import { Storage } from "@google-cloud/storage";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the Render secret file path instead of local file
const keyPath =
  process.env.NODE_ENV === "production"
    ? "/etc/secrets/coral-muse-465911-a1-3642d0c6df99.json"
    : path.join(__dirname, "coral-muse-465911-a1-3642d056df99.json");

const storage = new Storage({
  keyFilename: keyPath,
  projectId: "coral-muse-465911",
});

const bucket = storage.bucket("streamitbackend");

export default bucket;
