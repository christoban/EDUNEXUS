import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || "",
});

export const geminiModel = groq("llama-3.3-70b-versatile");

const cleanMarkdownArtifacts = (text: string): string => {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ""))
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
};

export const generateWithGemini = async (prompt: string, systemPrompt?: string): Promise<string> => {
  try {
    const { text } = await generateText({
      model: geminiModel,
      system:
        systemPrompt ||
        "Tu es un assistant pédagogique expert pour les établissements scolaires camerounais. Réponds toujours en français, de façon concise, naturelle et bienveillante. N'utilise pas de Markdown, pas d'astérisques, pas de dièses, pas de listes décorées, et pas de blocs de code sauf si l'utilisateur le demande explicitement.",
      prompt,
      maxOutputTokens: 1000,
    });
    return cleanMarkdownArtifacts(text);
  } catch (error: any) {
    console.error("Groq error:", error.message);
    throw new Error("Service IA temporairement indisponible");
  }
};
