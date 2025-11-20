import { bucket } from "../firebase/firebaseAdmin.js";

const uploadToFirebase = async (file, folder = "profiles") => {
  return new Promise((resolve, reject) => {
    const fileName = `${folder}/${Date.now()}_${file.originalname}`;
    const blob = bucket.file(fileName);

    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    blobStream.on("error", (err) => reject(err));

    blobStream.on("finish", async () => {
      // URL public Firebase
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
};

export { uploadToFirebase };
