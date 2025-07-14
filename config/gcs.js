import { Storage } from "@google-cloud/storage";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keyPath = path.join(__dirname, "coral-muse-465911-a1-3642d056df99.json");
const storage = new Storage({
  keyFilename: keyPath,
  projectId: "coral-muse-465911",
});
const bucket = storage.bucket("streamitbackend");

export default bucket;
