import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
	model: "gemini-robotics-er-1.5-preview",
});

export const aiClient = {
	async generate(prompt) {
		const result = await model.generateContent(prompt);
		return result.response.text();
	},
};

export default aiClient;
