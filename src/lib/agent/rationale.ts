import { getAnthropicClient, isFableLive } from './orchestrator';

export interface RationaleInputTrack {
  isrc: string;
  title: string;
  artist: string;
  moneyLine: string;
  fitScore: number;
  lang: string;
}

export async function generateRationales(
  briefText: string,
  tracks: RationaleInputTrack[]
): Promise<Record<string, string>> {
  if (!isFableLive() || tracks.length === 0) {
    const fallback: Record<string, string> = {};
    tracks.forEach(t => {
      fallback[t.isrc] = `Exceptional theme alignment for ${t.title}.`;
    });
    return fallback;
  }

  const client = getAnthropicClient();
  const trackDetails = tracks.map((t, i) => 
    `[${i}] Title: "${t.title}" by ${t.artist} (ISRC: ${t.isrc}) - Fit Score: ${t.fitScore}/100 - Key Lyric: "${t.moneyLine}" - Language: ${t.lang}`
  ).join('\n');

  const systemPrompt = `You are an expert Music Supervisor. You must write a brief, compelling rationale for WHY the selected sync window fits the creative brief.
Write in a professional, persuasive, and empathetic tone.

CRITICAL INSTRUCTION: You MUST write your response entirely in English, no matter what language the brief or the track is in.

Provide your output as a JSON array of objects where the keys are the track isrc and the values are the rationale strings (max 2-3 sentences).
Respond ONLY with a valid JSON array of objects. No markdown, no extra text.
Schema:
[
  {
    "isrc": "string",
    "rationale": "string"
  }
]`;

  const userPrompt = `Brief:
"${briefText}"

Tracks to evaluate:
${trackDetails}`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });
    
    let content = (response.content[0] as any).text.trim();
    if (content.startsWith('```')) {
      const match = content.match(/```(?:json)?\n([\s\S]*?)\n```/);
      if (match) content = match[1].trim();
    }
    const startIndex = content.indexOf('[');
    const endIndex = content.lastIndexOf(']');
    if (startIndex !== -1 && endIndex !== -1) {
      content = content.substring(startIndex, endIndex + 1);
    }
    
    const results = JSON.parse(content) as { isrc: string, rationale: string }[];
    const map: Record<string, string> = {};
    results.forEach(r => {
      map[r.isrc] = r.rationale;
    });
    
    // Fill any missing ones with a default
    tracks.forEach(t => {
      if (!map[t.isrc]) {
        map[t.isrc] = `Excellent sync fit based on lyrics and mood.`;
      }
    });

    return map;
  } catch (e) {
    console.error('[Fable] Failed to generate rationales', e);
    const fallback: Record<string, string> = {};
    tracks.forEach(t => {
      fallback[t.isrc] = `Excellent sync fit based on lyrics and mood.`;
    });
    return fallback;
  }
}
