import mongoose from "mongoose";
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB Connected");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
export default connectDB;

// Best practice: Use GOOGLE_APPLICATION_CREDENTIALS env variable to point to your service account JSON file
// On Render, set this env variable to: /etc/secrets/coral-muse-465911-a1-3642d0c6df99.json
// Locally, you can set it to your local path (e.g., server/config/your-service-account.json)

// Example for Google Cloud Storage client:
// const { Storage } = require('@google-cloud/storage');
// const storage = new Storage({
//   keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
// });
