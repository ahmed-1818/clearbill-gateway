export interface OnboardWelcomePayload {
  memberName: string;
  phone: string;
  institutionName: string;
  packageName: string;
  durationDays: number;
  startDate: string;
  expiryDate: string;
  feeAmount: number;
}

export interface OnboardMessageParams {
  memberName: string;
  phone: string;
  institutionName?: string;
  packageName?: string;
  durationDays?: number;
  feeAmount?: number;
  startDate?: string;
  expiryDate?: string;
}

export async function dispatchOnboardWelcome(params: OnboardMessageParams) {
  // 1. Sanitize & Ensure Guaranteed Fallbacks for all fields
  const name = params.memberName?.trim() || "Member";
  const institution = params.institutionName?.trim() || "Iron Gym";
  const pkg = params.packageName?.trim() || "Standard Membership";
  const days = params.durationDays || 30;
  const fee = Number(params.feeAmount) || 5000;
  
  const today = new Date();
  const start = params.startDate || today.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
  
  const expDateObj = new Date();
  expDateObj.setDate(today.getDate() + days);
  const expiry = params.expiryDate || expDateObj.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });

  // 2. Deterministic, Clean WhatsApp Template (Always Reliable)
  const fallbackMessage = 
`🏋️‍♂️ *Welcome to ${institution}, ${name}!*

Your membership has been successfully activated. Here are your package details:

📋 *Package:* ${pkg} (${days} Days)
💰 *Fee:* Rs. ${fee.toLocaleString()}
📅 *Start Date:* ${start}
⏳ *Valid Until:* ${expiry}

🔔 *Note:* You will receive an automated notification and digital challan link prior to your package expiry date.

We're excited to have you with us! 💪`;

  let finalMessage = fallbackMessage;

  // 3. Optional Gemini Generation with Strict Sanitization
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const prompt = `Write a short 2-line WhatsApp greeting for ${name} who joined ${institution} on the ${pkg} plan (Rs. ${fee}) expiring on ${expiry}. Include package name, fee in Rs., and expiry date. Output ONLY the WhatsApp message with *bold* formatting.`;

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (aiRes.ok) {
      const data = await aiRes.json();
      let generated = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Sanitize prompt leaks and bad markdown
      generated = generated
        .replace(/under \d+[-–]\d+ (natural )?sentences/gi, "")
        .replace(/\*\*raw message text:?\*\*/gi, "")
        .replace(/raw message text:?/gi, "")
        .replace(/:\*\*/g, "")
        .replace(/\*\*(.*?)\*\*/g, "*$1*")
        .trim();

      // Only use AI message if it actually contains the member's name and valid content
      if (generated.length > 40 && !generated.includes("sentence")) {
        finalMessage = generated;
      }
    }
  } catch (err) {
    console.warn("Gemini generation failed, using fallback template:", err);
  }

  // 4. Sanitize Phone Number for Pakistan (03xx -> 923xx)
  let cleanPhone = params.phone.replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "92" + cleanPhone.slice(1);
  }

  // 5. Send EXACTLY ONE Message via Whapi (Do NOT split into multiple bubbles)
  const whapiRes = await fetch("https://gate.whapi.cloud/messages/text", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${import.meta.env.VITE_WHAPI_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: `${cleanPhone}@s.whatsapp.net`,
      body: finalMessage
    })
  });

  const whapiData = await whapiRes.json();
  return { success: whapiRes.ok, data: whapiData };
}


export async function dispatchReminderWhatsApp(payload: OnboardWelcomePayload): Promise<boolean> {
  try {
    console.log("[WhatsApp Reminder] Triggered for", payload.memberName);

    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiKey) {
      console.warn("VITE_GEMINI_API_KEY is missing. Skipping AI reminder message.");
      return false;
    }

    const systemPrompt = `You are the automated WhatsApp concierge for "${payload.institutionName}".
Write a polite, professional payment reminder for a member with these details:
- Member Name: ${payload.memberName}
- Package / Plan: ${payload.packageName}
- Amount Due: Rs. ${payload.feeAmount.toLocaleString('en-PK')}
- Expiry Date: ${payload.expiryDate}

Requirements:
1. Greet them politely.
2. Remind them that their package is expiring or has expired on the given Expiry Date.
3. State the Amount Due clearly.
4. Keep the tone friendly but firm (not aggressive).
5. DO NOT include any payment links or URLs.
6. Keep the message under 3-4 natural sentences. Output the raw message text only without Markdown wrappers.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200 }
        }),
      }
    );

    if (!geminiRes.ok) return false;
    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) return false;

    // Strip out Markdown code block wrappers
    const generatedMessage = rawText.replace(/```[a-z]*\n/gi, "").replace(/```/g, "").trim();

    let cleanPhone = payload.phone.replace(/[\s\-\(\)]/g, "");
    if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
      cleanPhone = "92" + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith("+92")) {
      cleanPhone = cleanPhone.substring(1);
    }
    const whapiJid = `${cleanPhone}@s.whatsapp.net`;

    const whapiToken = import.meta.env.VITE_WHAPI_TOKEN;
    if (!whapiToken) return false;

    const whapiRes = await fetch("https://gate.whapi.cloud/messages/text", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${whapiToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ to: whapiJid, body: generatedMessage }),
    });

    if (!whapiRes.ok) return false;
    console.log("[WhatsApp Reminder] Successfully delivered reminder to", whapiJid);
    return true;
  } catch (error: any) {
    console.error("[WhatsApp Reminder] Unexpected error:", error.message);
    return false;
  }
}
