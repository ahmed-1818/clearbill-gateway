import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  template: z.string().min(1),
  instruction: z.string().min(1),
});

export const rewriteTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        messages: [
          {
            role: "system",
            content:
              "You rewrite WhatsApp fee-reminder templates for a Pakistani school. Keep the natural Urdu/English mix unless asked otherwise. You MUST preserve every {token} placeholder that appears in the original template, spelled exactly the same. Keep each message under 400 characters. Reply ONLY with a JSON array of 3 strings, no markdown, no commentary.",
          },
          {
            role: "user",
            content: `Original template:\n${data.template}\n\nRewrite instruction: ${data.instruction}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
      throw new Error(`AI request failed [${res.status}]: ${body}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\[[\s\S]*\]/);
    let drafts: string[] = [];
    try {
      drafts = JSON.parse(match ? match[0] : text);
    } catch {
      drafts = text
        .split(/\n{2,}/)
        .map((s) => s.replace(/^[-*\d.\s]+/, "").trim())
        .filter(Boolean);
    }
    return {
      drafts: drafts.filter((d) => typeof d === "string" && d.trim()).slice(0, 3),
    };
  });
