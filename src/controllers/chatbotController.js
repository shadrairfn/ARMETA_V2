import { sql } from "drizzle-orm";
import { db } from "../db/db.js";
import { aiClient } from "../service/llmService.js";
import { generateEmbedding } from "../service/vectorizationService.js";
import { BadRequestError } from "../utils/customError.js";

const askChatbot = async (req, res) => {
	const { question, id_subject } = req.body;
	const userId = req.user.id_user;

	if (!question || !id_subject) {
		throw new BadRequestError("question dan id_subject wajib diisi");
	}

	const queryEmbedding = await generateEmbedding(question);

	const similar = await db.execute(
		sql`
      SELECT
        id_review, body, files,
        (1 - (vectorize <=> ${JSON.stringify(queryEmbedding)}::vector)) AS similarity
      FROM reviews
      WHERE id_subject = ${id_subject}
      ORDER BY vectorize <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT 5
    `
	);

	const contexts = similar.rows.map((u, i) => `(${i + 1}) ${u.body}`).join("\n\n");

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

	return res.status(200).json({
		success: true,
		data: answer,
		message: "Success ask chatbot",
	});
};

const getChatHistory = async (req, res) => {
	const userId = req.user.id_user;

	if (!userId) {
		throw new BadRequestError("id_user wajib diisi");
	}

	const rows = await db.execute(sql`
    SELECT * FROM chatbot_history 
    WHERE id_user = ${userId}
    ORDER BY created_at DESC
  `);

	return res.json({
		success: true,
		data: rows.rows,
	});
};

export { askChatbot, getChatHistory };
