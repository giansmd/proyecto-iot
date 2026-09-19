import { targetDescription, visionResultSchema } from "@iot/shared";
import OpenAI from "openai";
import type {
  VisionAnalyzer,
  VisionTarget,
  VisionUsage,
} from "../../domain/ports.js";

function buildSystemPrompt(target: VisionTarget): string {
  const subject = targetDescription(target.targetType, target.targetLabel);
  return [
    `Eres un auditor que analiza fotografias de un ${subject}.`,
    `Primero determina si el ${subject} aparece en la imagen (campo "subjectVisible").`,
    'Si no aparece, responde subjectVisible=false, emptyDetected=false y emptyAreas=[].',
    "Si si aparece, determina si hay espacios vacios o faltantes que requieran reposicion",
    "(productos faltantes, huecos, frente vacio, zona despejada).",
    "Responde SIEMPRE en JSON valido, sin texto adicional, con este esquema:",
    '{"subjectVisible": boolean, "emptyDetected": boolean, "confidence": number (0..1),',
    '"description": string, "emptyAreas": [{"level": string, "detail": string, "severity": "low"|"medium"|"high"}]}',
    "Usa confidence para indicar tu certeza. Si no hay huecos, emptyDetected=false y emptyAreas=[].",
    "Se conservador: marca vacio solo cuando sea evidente que falta producto.",
  ].join(" ");
}

function buildUserPrompt(target: VisionTarget): string {
  const subject = targetDescription(target.targetType, target.targetLabel);
  return `Analiza esta imagen del ${subject} e indica si aparece y si hay espacios vacios que necesiten reposicion.`;
}

export interface OpenAIVisionOptions {
  apiKey: string;
  model: string;
  detail: "low" | "high" | "auto";
  maxOutputTokens: number;
  timeoutMs: number;
}

export class OpenAIVisionAdapter implements VisionAnalyzer {
  readonly model: string;
  private readonly client: OpenAI;
  private readonly detail: "low" | "high" | "auto";
  private readonly maxOutputTokens: number;

  constructor(options: OpenAIVisionOptions) {
    this.model = options.model;
    this.detail = options.detail;
    this.maxOutputTokens = options.maxOutputTokens;
    this.client = new OpenAI({
      apiKey: options.apiKey,
      timeout: options.timeoutMs,
    });
  }

  async analyze(input: {
    image: Buffer;
    target: VisionTarget;
  }): Promise<{ result: ReturnType<typeof visionResultSchema.parse>; usage: VisionUsage }> {
    const dataUrl = `data:image/jpeg;base64,${input.image.toString("base64")}`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: "json_object" },
      max_tokens: this.maxOutputTokens,
      messages: [
        { role: "system", content: buildSystemPrompt(input.target) },
        {
          role: "user",
          content: [
            { type: "text", text: buildUserPrompt(input.target) },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: this.detail },
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const result = visionResultSchema.parse(JSON.parse(raw));
    const usage: VisionUsage = {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
    };
    return { result, usage };
  }
}

/** Analizador de respaldo cuando no hay API key configurada (modo demo). */
export class NoopVisionAdapter implements VisionAnalyzer {
  readonly model = "noop";

  async analyze(): Promise<{
    result: ReturnType<typeof visionResultSchema.parse>;
    usage: VisionUsage;
  }> {
    return {
      result: {
        subjectVisible: true,
        emptyDetected: false,
        confidence: 0,
        description: "Analizador deshabilitado (sin OPENAI_API_KEY).",
        emptyAreas: [],
      },
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }
}
