import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });

const languageNames: Record<string, string> = {
  ko: "Korean", en: "English", ja: "Japanese", zh: "Simplified Chinese",
  "zh-TW": "Traditional Chinese", "zh-HK": "Traditional Chinese (Hong Kong)",
  th: "Thai", vi: "Vietnamese", ms: "Malay", id: "Indonesian", fil: "Filipino",
  hi: "Hindi", fr: "French", de: "German", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", ru: "Russian", tr: "Turkish", ar: "Arabic",
  el: "Greek", cs: "Czech", pl: "Polish", hu: "Hungarian", sv: "Swedish",
  no: "Norwegian", da: "Danish", fi: "Finnish", is: "Icelandic", he: "Hebrew",
};

function resolveLanguage(body: any, key: "source" | "target") {
  const explicit = body?.[`${key}Language`];
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const code = String(body?.[key] || "").trim();
  return languageNames[code] || code || (key === "target" ? "English" : "auto-detect");
}

const schema = `반드시 JSON 객체만 반환하세요. 형식: {"schedules":[{"date":"YYYY-MM-DD","start":"HH:MM 또는 빈 문자열","end":"HH:MM 또는 빈 문자열","title":"짧은 일정명","place":"장소명","category":"관광|식사|이동|호텔|쇼핑|기타","note":"간단한 메모","needsReview":false}]} 모르는 시간은 추측하지 말고 빈 문자열과 needsReview:true로 표시하세요.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
    const visionModel = Deno.env.get("OPENAI_VISION_MODEL") || model;
    if (!apiKey) return json({ error: "OPENAI_API_KEY가 없습니다." }, 500);

    let messages: any[] = [];
    let selectedModel = model;

    if (body.mode === "transcribe") {
      const raw = String(body.audio || "");
      const match = raw.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return json({ error: "올바른 음성 데이터가 아닙니다." }, 400);
      const mimeType = match[1] || String(body.mimeType || "audio/mp4");
      const binary = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
      const extension = mimeType.includes("wav") ? "wav" : mimeType.includes("webm") ? "webm" : mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "m4a";
      const form = new FormData();
      form.append("file", new Blob([binary], { type: mimeType }), `travelmate-voice.${extension}`);
      form.append("model", Deno.env.get("OPENAI_TRANSCRIBE_MODEL") || "gpt-4o-mini-transcribe");
      const lang = String(body.language || "").split("-")[0];
      if (lang && lang !== "local") form.append("language", lang);
      form.append("prompt", "여행 일정, 장소명, 호텔명, 음식점명과 현지 지명을 정확하게 받아쓰세요.");

      const transcription = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      const result = await transcription.json();
      if (!transcription.ok) return json({ error: result.error?.message || "음성 변환 실패" }, transcription.status);
      return json({ text: result.text || "", transcript: result.text || "" });
    }

    if (body.mode === "itinerary_generate") {
      messages = [
        { role: "system", content: `고령 여행자를 위한 여유롭고 안전한 일정을 한국어로 만드세요. 이동과 휴식을 고려하세요. ${schema}` },
        { role: "user", content: JSON.stringify(body) },
      ];
    } else if (body.mode === "itinerary_extract") {
      const document = body.document || {};
      const base = `여행정보:${JSON.stringify(body.trip)} 여행기간:${body.startDate}~${body.endDate} ${schema}`;
      if (document.kind === "image") {
        selectedModel = visionModel;
        messages = [
          { role: "system", content: "여행사 일정표 이미지에서 날짜, 시간, 장소, 이동, 식사, 호텔 일정을 정확히 추출하고 결과는 한국어로 작성하세요." },
          { role: "user", content: [{ type: "text", text: base }, { type: "image_url", image_url: { url: document.image } }] },
        ];
      } else if (document.kind === "pdf") {
        selectedModel = visionModel;
        messages = [
          { role: "system", content: "여행사 PDF 일정표에서 날짜, 시간, 장소, 이동, 식사, 호텔 일정을 추출하고 결과는 한국어로 작성하세요." },
          { role: "user", content: [{ type: "text", text: base }, { type: "file", file: { filename: document.name || "itinerary.pdf", file_data: document.file } }] },
        ];
      } else {
        messages = [
          { role: "system", content: "엑셀 또는 CSV 여행 일정표를 한국어로 정리하세요." },
          { role: "user", content: `${base} 표 데이터:${JSON.stringify(document.rows || [])}` },
        ];
      }
    } else if (body.mode === "assistant") {
      messages = [
        { role: "system", content: "70대 이상 사용자가 이해하기 쉬운 짧고 친절한 한국어로 답하세요." },
        { role: "user", content: JSON.stringify(body) },
      ];
    } else if (body.mode === "vision") {
      selectedModel = visionModel;
      messages = [
        { role: "system", content: "여행자가 이해하기 쉽게 이미지의 글자, 가격, 알레르기와 주의사항을 한국어로 정확하게 번역하고 정리하세요." },
        { role: "user", content: [{ type: "text", text: JSON.stringify(body.trip || {}) }, { type: "image_url", image_url: { url: body.image } }] },
      ];
    } else if (body.mode === "translate") {
      const sourceLanguage = resolveLanguage(body, "source");
      const targetLanguage = resolveLanguage(body, "target");
      messages = [
        {
          role: "system",
          content: `You are a travel interpreter. Translate only into ${targetLanguage}. Preserve names, numbers, prices, dates, and polite meaning. Do not answer the message or add explanations.`,
        },
        {
          role: "user",
          content: `Source language: ${sourceLanguage}\nTarget language: ${targetLanguage}\nText:\n${String(body.text || "")}`,
        },
      ];
    } else {
      return json({ error: "지원하지 않는 mode입니다." }, 400);
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        temperature: body.mode?.startsWith("itinerary_") ? 0.2 : 0.3,
        response_format: body.mode?.startsWith("itinerary_") ? { type: "json_object" } : undefined,
      }),
    });

    const data = await response.json();
    if (!response.ok) return json({ error: data.error?.message || "OpenAI 호출 실패" }, response.status);
    const content = data.choices?.[0]?.message?.content || "";
    if (body.mode?.startsWith("itinerary_")) return json(JSON.parse(content));
    return json({ result: content, translatedText: content, answer: content });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
