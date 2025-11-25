import { db } from "../db/db.js";
import { sql } from "drizzle-orm";
import { generateEmbedding } from "../service/vectorizationService.js";
import { aiClient } from "../service/llmService.js";

const askChatbot = async (req, res) => {
  const { question, id_matkul } = req.body;
  const userId = req.user.id_user;

  if (!question || !id_matkul) {
    return res.status(400).json({
      success: false,
      message: "question dan id_matkul wajib diisi"
    });
  }

  const queryEmbedding = await generateEmbedding(question);

  const similar = await db.execute(
    sql`
      SELECT
        id_ulasan, teks_ulasan, files,
        (1 - (vectorize_ulasan <=> ${JSON.stringify(queryEmbedding)}::vector)) AS similarity
      FROM ulasan
      WHERE id_matkul = ${id_matkul}
      ORDER BY vectorize_ulasan <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT 5
    `
  );

  const contexts = similar.rows.map((u, i) =>
    `(${i+1}) ${u.teks_ulasan}`
  ).join("\n\n");

  const prompt = `
    Gunakan konteks berikut dari ulasan mahasiswa terkait mata kuliah ini:

    ${contexts}

    Pertanyaan pengguna:
    "${question}"

    Berdasarkan konteks tersebut, berikan jawaban yang jelas, ringkas, dan relevan. Jika informasi tidak ditemukan, jawab dengan jujur.
    `;

  const answer = await aiClient.generate(prompt);

  await db.execute(sql`
    INSERT INTO chatbot_history (id_user, question, answer)
    VALUES (${userId}, ${question}, ${answer})
  `);

  res.json({
    success: true,
    answer,
    sources: similar.rows
  });
};

const getChatHistory = async (req, res) => {
  const userId = req.user.id_user;

  const rows = await db.execute(sql`
    SELECT * FROM chatbot_history 
    WHERE id_user = ${userId}
    ORDER BY created_at DESC
  `);

  res.json({
    success: true,
    history: rows.rows
  });
};

export { askChatbot, getChatHistory };