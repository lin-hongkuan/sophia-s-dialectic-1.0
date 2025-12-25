import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeTopic = async (userTopic: string): Promise<AnalysisResult> => {
  if (!apiKey) {
    throw new Error("缺少 API Key。请设置 process.env.API_KEY");
  }

  // Using the preview model for better reasoning capabilities and longer context window
  const model = "gemini-3-flash-preview";

  const prompt = `
    Role: You are Sophia (苏菲), a world-class philosophy dialectician and cultural critic.
    Task: Perform a surgical, deep-tissue philosophical dissection of the user's topic: "${userTopic}".
    
    CRITICAL REQUIREMENTS: 
    1. **MAXIMUM LENGTH**: The user explicitly requested content that is **2000+ CHINESE CHARACTERS (字)** per philosopher. This is non-negotiable.
    2. **LANGUAGE**: ALL OUTPUT MUST BE IN SIMPLIFIED CHINESE (zh-CN).
    3. **DYNAMIC SELECTION (CRITICAL)**: 
       - **FORBIDDEN DEFAULT**: Do NOT default to Kant, Nietzsche, or Socrates unless they are the absolute *perfect* technical fit for the specific nuance of the topic.
       - **WIDE SEARCH**: Scan the entire history of philosophy (including contemporary, eastern, structuralist, frankfurt school, etc.).
       - **EXAMPLES**: 
          - Topic "Social Media": Use Guy Debord (Spectacle) or Baudrillard (Simulacra).
          - Topic "Work/Burnout": Use Byung-Chul Han or Marx.
          - Topic "Love": Use Alain Badiou, Roland Barthes, or Erich Fromm.
       - **QUANTITY**: Select exactly **4 to 5** distinct philosophers/schools.
    4. **DEPTH**: You are writing a treatise, not a summary.

    Content Specs:
    - Introduction: ~200 words.
    - **Philosopher Arguments**: **2000 - 2500 Chinese characters EACH**. 
      To achieve this length, you MUST follow this structure for EACH philosopher's argument:
      1. **Metaphysical Foundation (Min 500 chars)**: Explain their core philosophy in extreme detail before mentioning the topic.
      2. **Phenomenological Diagnosis (Min 500 chars)**: Apply this lens to the user's specific topic "${userTopic}". dissect the nuance.
      3. **Dialectical Attack (Min 500 chars)**: Ruthlessly critique the potential opposing views of the OTHER selected philosophers.
      4. **Existential Prescription (Min 500 chars)**: What exactly should the human subject do?
    - Layers Content: ~500-800 words each.
    
    Style Guide:
    - Tone: Academic, rigorous, passionate, authoritative.
    - Format: Use multiple paragraphs. No bullet points within the argument text.
    
    Structure:
    1. Title: A "Big Question" formulation.
    2. Introduction: Set the stage.
    3. Philosophers: 4 to 5 thinkers.
    4. Layers: Common Sense, Theoretical, Ontological.

    Output: Strictly valid JSON.
  `;

  // We define the schema to ensure the UI renders correctly
  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          philosophical_title: { type: Type.STRING },
          introduction: { type: Type.STRING },
          reasoning_trace: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "8 steps of deep reasoning process in Chinese."
          },
          philosophers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                school: { type: Type.STRING },
                avatar_desc: { type: Type.STRING },
                core_concept: { type: Type.STRING },
                argument: { type: Type.STRING, description: "A MASSIVE, 2000+ character philosophical treatise in Chinese." },
                quote: { type: Type.STRING },
              },
              required: ["name", "school", "core_concept", "argument", "quote"]
            }
          },
          layers: {
            type: Type.OBJECT,
            properties: {
              common_sense: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.STRING, description: "Long-form analysis of social norms (500+ chars) in Chinese." },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "content", "keywords"]
              },
              theoretical: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.STRING, description: "Deep theoretical breakdown (500+ chars) in Chinese." },
                  concepts: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "content", "concepts"]
              },
              ontological: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.STRING, description: "Existential reflection (400+ chars) in Chinese." },
                  question: { type: Type.STRING }
                },
                required: ["title", "content", "question"]
              }
            },
            required: ["common_sense", "theoretical", "ontological"]
          }
        },
        required: ["philosophical_title", "introduction", "philosophers", "layers", "reasoning_trace"]
      }
    }
  });

  if (!response.text) {
    throw new Error("苏菲没有回应。");
  }

  try {
    return JSON.parse(response.text) as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse JSON", e);
    throw new Error("苏菲正在沉思，暂时无法组织语言。");
  }
};

export const getReflectionFeedback = async (topic: string, userReflection: string): Promise<string> => {
   if (!apiKey) return "API Key 缺失。";
   
   const response = await ai.models.generateContent({
     model: "gemini-3-flash-preview",
     contents: `
      Topic: ${topic}
      User's Reflection: ${userReflection}
      
      You are Sophia. Provide a sharp, insightful evaluation of the user's stance.
      Connect their view to a specific philosopher or school of thought.
      Be encouraging but intellectually rigorous.
      Language: Simplified Chinese (zh-CN).
     `
   });
   
   return response.text || "非常有意思的观点。";
};