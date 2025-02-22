import type { MediaItem } from "@/data/schema";
import type { MediaType } from "@/data/store";
import { fal } from "./fal";
import { extractJson } from "./utils";

export type ModelStats = {
  modelId: string;
  totalGenerations: number;
  positive: number;
  negative: number;
  unrated: number;
  positiveRate: number;
  negativeRate: number;
  unratedRate: number;
};

export type CategoryStats = {
  category: MediaType;
  totalGenerations: number;
  positive: number;
  negative: number;
  unrated: number;
  positiveRate: number;
  negativeRate: number;
  unratedRate: number;
};

export type PromptHistory = {
  prompt: string;
  rating: "positive" | "negative";
  timestamp: number;
  modelId: string;
  imageUrl?: string;
};

export type SceneAnalysis = {
  imageUrl?: string;
  attempts: Array<{
    prompt: string;
    rating: "positive" | "negative";
    comparison: string;
  }>;
  insights: string[];
};

export type PromptAnalysis = {
  category: MediaType;
  promptHistory: PromptHistory[];
  analysis: {
    successPatterns: string[];
    evolutionInsights: string[];
    recommendations: string[];
    sceneAnalysis: SceneAnalysis[];
  };
};

export function normalizeModelId(modelId: string): string {
  if (!modelId) return modelId;
  
  // Handle Kling model variants
  if (modelId.includes("kling-video")) {
    const parts = modelId.split("/");
    // Find version and variant parts
    const version = parts.find(p => p.startsWith("v"));
    const variant = parts.find(p => p === "standard" || p === "pro");
    
    if (version && variant) {
      return `fal-ai/kling-video/${version}/${variant}`;
    }
  }
  
  // Handle other model variants
  return modelId
    .replace("/image-to-video", "")
    .replace("/text-to-video", "");
}

export function calculateModelStats(mediaItems: MediaItem[]): ModelStats[] {
  // Group by model (endpointId), normalizing IDs to handle variants
  const byModel = new Map<string, MediaItem[]>();

  for (const item of mediaItems) {
    if (item.kind !== "generated" || !item.endpointId) continue;
    const normalizedId = normalizeModelId(item.endpointId);
    if (!byModel.has(normalizedId)) {
      byModel.set(normalizedId, []);
    }
    byModel.get(normalizedId)!.push(item);
  }

  // Calculate stats for each model
  return Array.from(byModel.entries()).map(([modelId, items]) => {
    const total = items.length;
    const positive = items.filter((i) => i.rating === "positive").length;
    const negative = items.filter((i) => i.rating === "negative").length;
    const unrated = items.filter((i) => i.rating === undefined).length;

    return {
      modelId,
      totalGenerations: total,
      positive,
      negative,
      unrated,
      positiveRate: total > 0 ? (positive / total) * 100 : 0,
      negativeRate: total > 0 ? (negative / total) * 100 : 0,
      unratedRate: total > 0 ? (unrated / total) * 100 : 0,
    };
  });
}

export function calculateCategoryStats(
  mediaItems: MediaItem[],
): CategoryStats[] {
  // Group by media type
  const byCategory = new Map<MediaType, MediaItem[]>();

  for (const item of mediaItems) {
    if (item.kind !== "generated") continue;
    const category = item.mediaType;
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(item);
  }

  // Calculate stats for each category
  return Array.from(byCategory.entries()).map(([category, items]) => {
    const total = items.length;
    const positive = items.filter((i) => i.rating === "positive").length;
    const negative = items.filter((i) => i.rating === "negative").length;
    const unrated = items.filter((i) => i.rating === undefined).length;

    return {
      category,
      totalGenerations: total,
      positive,
      negative,
      unrated,
      positiveRate: total > 0 ? (positive / total) * 100 : 0,
      negativeRate: total > 0 ? (negative / total) * 100 : 0,
      unratedRate: total > 0 ? (unrated / total) * 100 : 0,
    };
  });
}

export function getModelName(modelId: string): string {
  // Normalize the model ID
  const normalizedId = normalizeModelId(modelId);
  
  const parts = normalizedId.split("/");
  if (parts.length < 2) return modelId;

  // Remove fal-ai prefix if present
  if (parts[0] === "fal-ai") {
    parts.shift();
  }

  // Capitalize and clean up remaining parts
  return parts
    .map((part) =>
      part
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    )
    .join(" ");
}

export async function analyzePrompts(
  mediaItems: MediaItem[],
  options?: { customSystemPrompt?: string },
): Promise<PromptAnalysis[]> {
  // Group by category
  const byCategory = new Map<MediaType, MediaItem[]>();

  for (const item of mediaItems) {
    if (item.kind !== "generated" || !item.input?.prompt || !item.rating)
      continue;
    const category = item.mediaType;
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(item);
  }

  // Analyze prompts for each category
  const analyses = await Promise.all(
    Array.from(byCategory.entries()).map(async ([category, items]) => {
      // Sort items by timestamp
      const sortedItems = items.sort((a, b) => a.createdAt - b.createdAt);

      // Create prompt history
      const promptHistory = sortedItems
        .filter(
          (item): item is MediaItem & { endpointId: string } =>
            item.kind === "generated" && typeof item.endpointId === "string",
        )
        .map((item) => ({
          prompt: item.input?.prompt as string,
          rating: item.rating as "positive" | "negative",
          timestamp: item.createdAt,
          modelId: item.endpointId,
          imageUrl: item.input?.image_url as string | undefined,
        }));

      // Skip if no rated prompts
      if (promptHistory.length === 0) {
        return null;
      }

      const analysis = await analyzeWithGemini(
        category,
        promptHistory,
        options?.customSystemPrompt,
      );

      return {
        category,
        promptHistory,
        analysis,
      } as PromptAnalysis;
    }),
  );

  return analyses.filter((a): a is NonNullable<typeof a> => a !== null);
}

async function analyzeWithGemini(
  category: MediaType,
  promptHistory: PromptHistory[],
  customSystemPrompt?: string,
): Promise<PromptAnalysis["analysis"]> {
  const isVideo = category === "video";

  const defaultSystemPrompt = `You are an AI prompt analysis assistant specializing in ${category} generation.
Your task is to analyze the evolution of prompts over time and identify what changes led to successful outcomes. 
${
  isVideo
    ? `For video content, you will analyze related attempts at generating the same scene, primarily identified by shared image URLs. Pay special attention to how different prompt variations affect the same base image and identify which changes led to better results.`
    : `For ${category} content, you will analyze groups of prompts that share similar goals or techniques. Examine prompt length, structure, focus, etc. The most successful prompts are the ones that generate a positively-rated output in one attempt. Focus on understanding which variations in approach were most effective and what patterns emerge across successful attempts.`
}

Examine prompt length, structure, focus, etc. The most successful prompts are the ones that generate a positively-rated output in one attempt.

Your analysis should cover:
1. Patterns that consistently led to successful generations across all attempts
2. Key changes and refinements that turned unsuccessful prompts into successful ones
3. Strategic recommendations for future prompt crafting
4. ${
    isVideo
      ? `Detailed analysis of each scene group, comparing different attempts and understanding what changes improved results`
      : `Analysis of prompt groups sharing similar objectives, comparing different approaches and identifying the most effective techniques`
  }

IMPORTANT: You must respond with valid JSON only. No other text or explanation.
The JSON must match exactly the structure shown in the prompt.`;

  const prompt = `Analyze this chronological history of ${category} generation prompts:

PROMPT HISTORY:
${promptHistory.map((p, i) => `${i + 1}. [${p.rating.toUpperCase()}] ${p.prompt}${isVideo && p.imageUrl ? ` [Image: ${p.imageUrl}]` : ""}`).join("\n")}

Provide a comprehensive analysis in the following JSON structure:
{
  "successPatterns": [
    "Detailed description of pattern that led to success",
    "Another pattern with specific examples from the prompts"
  ],
  "evolutionInsights": [
    "Insight about how prompts evolved and improved over time",
    "Another insight about successful refinements"
  ],
  "recommendations": [
    "Specific, actionable recommendation based on the analysis",
    "Another strategic recommendation with clear reasoning"
  ],
  "sceneAnalysis": [
    {
      ${
        isVideo
          ? `"imageUrl": "URL of the source image for this scene group",`
          : `"theme": "Description of what this group of prompts aims to achieve",`
      }
      "attempts": [
        {
          "prompt": "exact prompt text",
          "rating": "positive or negative",
          "comparison": "Detailed analysis of how this attempt differed from others and why it worked or didn't work"
        }
      ],
      "insights": [
        "Specific insight about what worked or didn't work for this group",
        "Technical observation about prompt structure or approach"
      ]
    }
  ]
}

Analysis Guidelines:
${
  isVideo
    ? `For video generation analysis, examine how different prompts affect the same base image. Look for:
- How prompt variations change the interpretation of the same image
- Which modifications to prompt structure or content led to better animations
- Patterns in successful adaptations of the base image
- Specific techniques that improved motion or maintained image fidelity`
    : `For ${category} generation analysis, examine how different approaches affect similar goals. Look for:
- Common elements in prompts trying to achieve similar effects
- How variations in technique or structure affected results
- Patterns in prompt construction that consistently worked well
- Specific approaches that led to higher quality outputs`
}

Remember: Your response must be a single, valid JSON object matching the structure above. No other text or explanation.`;

  try {
    const { data } = await fal.subscribe("fal-ai/any-llm", {
      input: {
        prompt,
        system_prompt: customSystemPrompt || defaultSystemPrompt,
        model: "google/gemini-flash-1.5",
      },
    });

    try {
      // Clean the response to ensure it's valid JSON
      const cleanedResponse = data.output
        .trim()
        // Remove any markdown code block markers
        .replace(/```json\n?|\n?```/g, "")
        // Remove any trailing commas before closing brackets/braces
        .replace(/,(\s*[}\]])/g, "$1");

      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error("Failed to parse LLM response as JSON:", error);
      console.error("Raw response:", data.output);
      return {
        successPatterns: ["Could not analyze patterns in prompts"],
        evolutionInsights: ["Could not analyze prompt evolution"],
        recommendations: ["Try more prompt variations to get better analysis"],
        sceneAnalysis: [],
      };
    }
  } catch (error) {
    console.error("Error analyzing prompts with LLM:", error);
    return {
      successPatterns: [],
      evolutionInsights: [],
      recommendations: ["An error occurred while analyzing prompts"],
      sceneAnalysis: [],
    };
  }
}
