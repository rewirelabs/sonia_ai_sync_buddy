import fs from 'fs/promises';
import path from 'path';
import { LyricDoc, RichSyncLine } from './types';
import { isMusixmatchLive } from '../config/flags';

async function getFixtureRichSync(isrc: string): Promise<RichSyncLine[]> {
  try {
    const fixturePath = path.join(process.cwd(), 'fixtures', 'richsync', `${isrc}.json`);
    const data = await fs.readFile(fixturePath, 'utf-8');
    return JSON.parse(data) as RichSyncLine[];
  } catch (e) {
    console.warn(`[Musixmatch] No fixture found for ${isrc}. Returning empty array.`);
    return [];
  }
}

const MXM_BASE = 'https://api.musixmatch.com/ws/1.1';

async function fetchMxm(endpoint: string, params: Record<string, string>) {
  const url = new URL(`${MXM_BASE}${endpoint}`);
  url.searchParams.append('apikey', process.env.MUSIXMATCH_API_KEY!);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.append(k, v);
  }
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.message.header.status_code !== 200) {
    throw new Error(`MXM API error: ${data.message.header.status_code}`);
  }
  return data.message.body;
}

export async function findTrackIsrc(title: string, artist: string): Promise<string | null> {
  try {
    // track.search is much more forgiving with punctuation/features than matcher.track.get
    const trackBody = await fetchMxm('/track.search', {
      q_track: title,
      q_artist: artist,
      page_size: '1',
      s_track_rating: 'desc'
    });
    
    if (trackBody.track_list && trackBody.track_list.length > 0) {
      return trackBody.track_list[0].track.track_isrc || null;
    }
    return null;
  } catch (e) {
    console.error(`[Musixmatch] Failed to find ISRC for ${title} by ${artist}`, e);
    return null;
  }
}

export async function searchTracksByLyrics(keywords: string, lang: string): Promise<{ isrc: string, title: string, artist: string, lang: string }[]> {
  try {
    const trackBody = await fetchMxm('/track.search', {
      q_lyrics: keywords,
      f_lyrics_language: lang || 'en',
      s_track_rating: 'desc',
      page_size: '50',
      f_has_lyrics: '1'
    });
    const trackList = trackBody.track_list;
    if (!trackList || trackList.length === 0) return [];

    return trackList.map((t: any) => ({
      isrc: t.track.track_isrc,
      title: t.track.track_name,
      artist: t.track.artist_name,
      lang: t.track.primary_lang
    })).filter((t: any) => t.isrc != null);
  } catch (e) {
    console.error(`[Musixmatch] Failed to search tracks by lyrics "${keywords}"`, e);
    return [];
  }
}

export async function getMusixmatchLyricDoc(isrc: string): Promise<LyricDoc & { lang?: string, translatedLines?: RichSyncLine[] } | null> {
  if (!isMusixmatchLive()) {
    console.log(`[Musixmatch] Fetching fixture data for ${isrc}`);
    const lines = await getFixtureRichSync(isrc);
    return {
      isrc,
      lines,
      mood: {
        valence: 0.2,
        energy: 0.8
      },
      lang: 'en'
    };
  }

  try {
    // 1. Get Track
    const trackBody = await fetchMxm('/track.get', { track_isrc: isrc });
    const trackId = trackBody.track.track_id;
    const commonTrackId = trackBody.track.commontrack_id;
    const trackLang = trackBody.track.primary_lang;

    // 2. Get Sync (Try Richsync, fallback to Subtitle)
    let lines: RichSyncLine[] = [];
    try {
      const syncBody = await fetchMxm('/track.richsync.get', { commontrack_id: commonTrackId.toString() });
      const richsyncList = JSON.parse(syncBody.richsync.richsync_body);
      lines = richsyncList.map((l: any) => ({
        startMs: l.ts * 1000,
        endMs: l.te * 1000,
        text: l.x,
      }));
    } catch (e) {
      console.log(`[Musixmatch] Richsync failed for ${isrc}, falling back to subtitle.`);
      try {
        const subBody = await fetchMxm('/track.subtitle.get', { commontrack_id: commonTrackId.toString() });
        const subList = JSON.parse(subBody.subtitle.subtitle_body);
        lines = subList.map((l: any) => ({
          startMs: l.time.total * 1000,
          endMs: (l.time.total + 5) * 1000, // naive endMs if not provided
          text: l.text,
        }));
      } catch (subErr) {
        console.error(`[Musixmatch] Subtitle also failed or parsing failed for ${isrc}. Skipping lyrics.`);
        return null;
      }
    }

    // 2.5 Translation
    let translatedLines: RichSyncLine[] | undefined = undefined;
    if (trackLang && trackLang !== 'en') {
      try {
        console.log(`[Musixmatch] Track ${isrc} is in ${trackLang}, fetching English translation...`);
        const transBody = await fetchMxm('/track.subtitle.translation.get', { 
          commontrack_id: commonTrackId.toString(), 
          selected_language: 'en' 
        });
        const transList = JSON.parse(transBody.subtitle_translation.subtitle_translation_body);
        translatedLines = transList.map((l: any) => ({
          startMs: l.time.total * 1000,
          endMs: (l.time.total + 5) * 1000,
          text: l.translation,
        }));
      } catch (e) {
        console.warn(`[Musixmatch] Could not fetch translation for ${isrc}`, e);
      }
    }

    // 3. Get Mood (Optional)
    let mood;
    try {
      const moodBody = await fetchMxm('/track.lyrics.mood.get', { commontrack_id: commonTrackId.toString() });
      mood = {
        valence: moodBody.mood.valence,
        energy: moodBody.mood.energy
      };
    } catch (e) {
      // ignore
    }

    return {
      isrc,
      lines,
      mood,
      lang: trackLang,
      translatedLines
    };
  } catch (e) {
    console.error(`[Musixmatch] Live API failed for ${isrc}`, e);
    return null;
  }
}
