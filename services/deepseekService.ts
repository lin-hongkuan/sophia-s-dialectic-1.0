import { AnalysisResult } from "../types";

const apiKey = process.env.API_KEY || '';

// DeepSeek API 配置
const DEEPSEEK_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';

export const analyzeTopic = async (userTopic: string): Promise<AnalysisResult> => {
  if (!apiKey) {
    throw new Error("缺少 API Key。请在 GitHub Secrets 或本地 .env.local 文件中设置 DEEPSEEK_API_KEY");
  }

  const systemPrompt = `
    Role: You are Sophia (苏菲), a world-class philosophy dialectician and cultural critic.
    
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
      2. **Phenomenological Diagnosis (Min 500 chars)**: Apply this lens to the user's specific topic, dissect the nuance.
      3. **Dialectical Attack (Min 500 chars)**: Ruthlessly critique the potential opposing views of the OTHER selected philosophers.
      4. **Existential Prescription (Min 500 chars)**: What exactly should the human subject do?
    - Layers Content: ~500-800 words each.
    
    Style Guide:
    - Tone: Academic, rigorous, passionate, authoritative.
    - Format: Use multiple paragraphs. No bullet points within the argument text.
    
    Output Format: You MUST output ONLY valid JSON with this exact structure (no markdown, no code blocks):
    {
      "philosophical_title": "A 'Big Question' formulation in Chinese",
      "introduction": "Set the stage in Chinese (~200 words)",
      "reasoning_trace": ["Step 1 reasoning in Chinese", "Step 2...", ... (8 steps total)],
      "philosophers": [
        {
          "name": "Philosopher Name",
          "school": "School of thought",
          "avatar_desc": "Description for avatar",
          "core_concept": "Core concept name",
          "argument": "MASSIVE 2000+ character treatise in Chinese",
          "quote": "Relevant quote"
        }
      ],
      "layers": {
        "common_sense": {
          "title": "Title in Chinese",
          "content": "Long analysis (500+ chars) in Chinese",
          "keywords": ["keyword1", "keyword2", ...]
        },
        "theoretical": {
          "title": "Title in Chinese",
          "content": "Deep breakdown (500+ chars) in Chinese",
          "concepts": ["concept1", "concept2", ...]
        },
        "ontological": {
          "title": "Title in Chinese",
          "content": "Existential reflection (400+ chars) in Chinese",
          "question": "A profound question in Chinese"
        }
      }
    }
  `;

  const userMessage = `Perform a surgical, deep-tissue philosophical dissection of the user's topic: "${userTopic}". Remember to output ONLY valid JSON.`;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3.2', // SiliconFlow Model Name
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 8192,
        response_format: { type: 'json_object' } // 强制 JSON 输出
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('DeepSeek API Error:', errorData);
      throw new Error(`API 请求失败: ${response.status} - ${errorData.error?.message || '未知错误'}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error("苏菲没有回应。API 返回数据格式异常。");
    }

    const content = data.choices[0].message.content;
    
    try {
      // 尝试解析 JSON
      let jsonContent = content.trim();
      
      // 如果返回包含 markdown 代码块，提取 JSON
      if (jsonContent.startsWith('```')) {
        const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1].trim();
        }
      }
      
      const result = JSON.parse(jsonContent) as AnalysisResult;
      
      // 验证必要字段
      if (!result.philosophical_title || !result.philosophers || !result.layers) {
        throw new Error("返回数据缺少必要字段");
      }
      
      return result;
    } catch (parseError) {
      console.error("Failed to parse JSON:", parseError);
      console.error("Raw content:", content);
      throw new Error("苏菲正在沉思，暂时无法组织语言。请稍后重试。");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("网络请求失败，请检查您的网络连接。");
  }
};

export const getReflectionFeedback = async (topic: string, userReflection: string): Promise<string> => {
  if (!apiKey) return "API Key 缺失。";
  
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3.2',
        messages: [
          {
            role: 'system',
            content: `You are Sophia, a philosophical guide. Provide sharp, insightful evaluations.
                      Connect views to specific philosophers or schools of thought.
                      Be encouraging but intellectually rigorous.
                      Language: Simplified Chinese (zh-CN).`
          },
          {
            role: 'user',
            content: `Topic: ${topic}\nUser's Reflection: ${userReflection}\n\nProvide your philosophical evaluation.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      throw new Error("API 请求失败");
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "苏菲正在沉思...";
  } catch (error) {
    console.error("Reflection feedback error:", error);
    return "苏菲暂时无法回应，请稍后再试。";
  }
};
