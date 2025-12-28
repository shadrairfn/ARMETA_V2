import { VoyageAIClient } from "voyageai";

// Initialize Voyage AI client
const voyageClient = new VoyageAIClient({
	apiKey: process.env.VOYAGE_API_KEY,
});

/**
 * Generate embedding vector from text using Voyage AI
 * @param {string} text - Text to vectorize
 * @param {string} model - Model to use (default: voyage-3)
 * @returns {Promise<number[]>} - Embedding vector
 */
export const generateEmbedding = async (text, model = "voyage-3") => {
	try {
		if (!text || text.trim().length === 0) {
			throw new Error("Text cannot be empty");
		}

		// Call Voyage AI API to generate embedding
		const response = await voyageClient.embed({
			input: text,
			model: model,
			inputType: "document", // Options: "document", "query"
		});

		// Return the embedding vector
		return response.data[0].embedding;
	} catch (error) {
		console.error("Error generating embedding:", error);
		throw new Error(`Failed to generate embedding: ${error.message}`);
	}
};

/**
 * Generate embeddings for multiple texts (batch processing)
 * @param {string[]} texts - Array of texts to vectorize
 * @param {string} model - Model to use (default: voyage-3)
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export const generateEmbeddingsBatch = async (texts, model = "voyage-3") => {
	try {
		if (!texts || texts.length === 0) {
			throw new Error("Texts array cannot be empty");
		}

		// Call Voyage AI API to generate embeddings
		const response = await voyageClient.embed({
			input: texts,
			model: model,
			inputType: "document",
		});

		// Return all embedding vectors
		return response.data.map((item) => item.embedding);
	} catch (error) {
		console.error("Error generating embeddings:", error);
		throw new Error(`Failed to generate embeddings: ${error.message}`);
	}
};

/**
 * Generate query embedding (optimized for search)
 * @param {string} query - Query text
 * @param {string} model - Model to use (default: voyage-3)
 * @returns {Promise<number[]>} - Query embedding vector
 */
export const generateQueryEmbedding = async (query, model = "voyage-3") => {
	try {
		if (!query || query.trim().length === 0) {
			throw new Error("Query cannot be empty");
		}

		// Call Voyage AI API with query input type
		const response = await voyageClient.embed({
			input: query,
			model: model,
			inputType: "query", // Optimized for search queries
		});

		// Return the query embedding vector
		return response.data[0].embedding;
	} catch (error) {
		console.error("Error generating query embedding:", error);
		throw new Error(`Failed to generate query embedding: ${error.message}`);
	}
};

export default {
	generateEmbedding,
	generateEmbeddingsBatch,
	generateQueryEmbedding,
};
