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
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${blob.name}`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
};

export { uploadToFirebase };

// let parts = blob.name.split("/");
//       let detail = parts[1].split(" ");

//       let akhir = `${parts[0]}%2F${detail[0]}%20${detail[1]}`
//       const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${akhir}?alt=media`;
//       resolve(publicUrl);
