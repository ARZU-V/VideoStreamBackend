import { Storage } from "@google-cloud/storage";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use environment variable for GCS credentials instead of file path
let storage;

if (process.env.NODE_ENV === "production") {
  // For Render deployment, use environment variable
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    );
    storage = new Storage({
      projectId: "coral-muse-465911",
      credentials: credentials,
    });
  } else {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is required for production"
    );
  }
} else {
  // For local development, use local file
  const keyPath = path.join(
    __dirname,
    "coral-muse-465911-a1-3642d056df99.json"
  );
  storage = new Storage({
    keyFilename: keyPath,
    projectId: "coral-muse-465911",
  });
}

const bucket = storage.bucket("streamitbackend");

export default bucket;
