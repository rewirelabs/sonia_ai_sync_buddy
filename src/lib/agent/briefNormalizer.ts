import { TargetArc } from '../types';
import { getAnthropicClient, isFableLive } from './orchestrator';

export async function normalizeBrief(briefText: string): Promise<TargetArc> {
  if (!isFableLive()) {
    console.log('[Fable] Fixture mode: returning mock TargetArc');
    return {
      shape: 'build',
      peakPositionPct: 0.8,
      vocalGender: 'any',
      themesIncluded: ['family', 'journey', 'open road'],
      themesExcluded: ['violence', 'drugs', 'explicit content'],
      targetMarkets: ['DACH', 'Italy'],
      languages: ['de', 'en', 'it'],
      targetDurationSec: 30,
      brandProfile: 'family automotive',
      targetEnergy: 0.8,
      targetValence: 0.6
    };
  }

  const client = getAnthropicClient();
  const systemPrompt = `You are Fable, an expert music supervisor AI.
Extract structured metadata from the following scene brief.
Respond ONLY with a valid JSON object matching this schema:
{
  "shape": "build" | "steady" | "peak_early" | "peak_late" | "pulse",
  "peakPositionPct": number (0.0 to 1.0),
  "vocalGender": "male" | "female" | "any",
  "themesIncluded": string[],
  "themesExcluded": string[],
  "targetMarkets": string[],
  "languages": string[],
  "targetDurationSec": number (usually 30),
  "brandProfile": string,
  "targetEnergy": number (0.0 for very calm/acoustic, 1.0 for highly energetic/action),
  "targetValence": number (-1.0 for sad/dramatic, 1.0 for very happy/uplifting)
}`;

  const userPrompt = `Raw Brief: "${briefText}"`;

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
    return JSON.parse(content) as TargetArc;
  } catch (e) {
    console.error('[Fable] Failed to normalize brief', e);
    throw new Error('Brief normalization failed');
  }
}
