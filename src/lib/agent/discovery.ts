import { TargetArc } from '../types';
import { getAnthropicClient, isFableLive } from './orchestrator';

export interface DiscoveredSong {
  title: string;
  artist: string;
}

export interface DiscoveryResult {
  tracks: DiscoveredSong[];
  lyricalKeywords: string;
}

export async function discoverCandidates(targetArc: TargetArc): Promise<DiscoveryResult> {
  if (!isFableLive()) {
    return {
      tracks: [
        { title: 'Shape of You', artist: 'Ed Sheeran' },
        { title: 'Blinding Lights', artist: 'The Weeknd' },
      ],
      lyricalKeywords: "falling in love, running fast"
    };
  }

  const client = getAnthropicClient();
  const systemPrompt = `You are Fable, an avant-garde music supervisor AI.
The user will provide a brief. You must discover exactly 10 distinct tracks that are PERFECT for this brief.
IMPORTANT: SUGGEST ONLY FAMOUS, WELL-KNOWN, GLOBAL HIT TRACKS. The user wants highly recognizable, top-tier commercial music (e.g. Avicii, Maroon 5, Coldplay, Edward Sharpe). 
Do NOT suggest obscure indie tracks, deep cuts, or slow local ballads (e.g. NO Jovanotti, NO Marco Mengoni) unless the brief explicitly asks for them. Ensure the vibe and energy perfectly match the brief.

Return ONLY a valid JSON object matching this schema, no markdown, no text:
{
  "tracks": [
    { "title": "Track Name", "artist": "Artist Name" }
  ],
  "lyricalKeywords": "Hyper-specific 3-5 word phrase capturing the core lyrical essence needed for the scene. Must be highly relevant to the brief. Example: 'burning neon city' or 'break my heart again'"
}

EXAMPLES:

Brief: {"themesIncluded": ["journey", "family", "open road"], "shape": "build", "brandProfile": "Family car commercial", "targetEnergy": 0.85}
Response:
{
  "tracks": [
    { "title": "Home", "artist": "Edward Sharpe & The Magnetic Zeros" },
    { "title": "Wake Me Up", "artist": "Avicii" },
    { "title": "Maps", "artist": "Maroon 5" }
  ],
  "lyricalKeywords": "going home together"
}

Brief: {"themesIncluded": ["seduction", "night", "mystery"], "shape": "pulse", "brandProfile": "Luxury Perfume", "targetEnergy": 0.6}
Response:
{
  "tracks": [
    { "title": "Do I Wanna Know?", "artist": "Arctic Monkeys" },
    { "title": "Earned It", "artist": "The Weeknd" },
    { "title": "Glory Box", "artist": "Portishead" }
  ],
  "lyricalKeywords": "shadows in the dark"
}

Brief: {"themesIncluded": ["rebellion", "fight", "power"], "shape": "steady", "brandProfile": "Action Movie Trailer", "targetEnergy": 0.95}
Response:
{
  "tracks": [
    { "title": "Seven Nation Army", "artist": "The White Stripes" },
    { "title": "Sabotage", "artist": "Beastie Boys" },
    { "title": "Run Boy Run", "artist": "Woodkid" }
  ],
  "lyricalKeywords": "ready for the fight"
}`;

  const userPrompt = `Brief details:
Languages: ${targetArc.languages.join(', ')}
Themes: ${targetArc.themesIncluded.join(', ')}
Excluded Themes: ${targetArc.themesExcluded.join(', ')}
Shape: ${targetArc.shape}
Brand Profile: ${targetArc.brandProfile || 'Generic'}`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
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
    const startIndex = content.indexOf('{');
    const endIndex = content.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
      content = content.substring(startIndex, endIndex + 1);
    }
    return JSON.parse(content) as DiscoveryResult;
  } catch (e) {
    console.error('[Fable] Failed to discover candidates', e);
    return { tracks: [], lyricalKeywords: "" };
  }
}
