import { flags } from '../config/flags';

interface SpotifyEnrichment {
  coverUrl?: string;
  previewUrl?: string;
  spotifyId?: string;
}

export async function enrichWithSpotify(isrc: string): Promise<SpotifyEnrichment> {
  if (!flags.spotifyEnrichment) {
    return {};
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[Spotify] Missing credentials, skipping enrichment');
    return {};
  }

  try {
    // 1. Get Access Token
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });
    
    if (!tokenRes.ok) throw new Error('Spotify auth failed');
    const { access_token } = await tokenRes.json();

    // 2. Search by ISRC
    const searchRes = await fetch(`https://api.spotify.com/v1/search?type=track&q=isrc:${isrc}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    if (!searchRes.ok) throw new Error('Spotify search failed');
    const searchData = await searchRes.json();
    
    const track = searchData.tracks?.items?.[0];
    if (track) {
      let energy = undefined;
      let valence = undefined;
      
      try {
        const featRes = await fetch(`https://api.spotify.com/v1/audio-features/${track.id}`, {
          headers: { 'Authorization': `Bearer ${access_token}` }
        });
        if (featRes.ok) {
          const featData = await featRes.json();
          energy = featData.energy;
          valence = featData.valence;
        }
      } catch(e) {
        // fail silently if audio features missing
      }

      return {
        coverUrl: track.album?.images?.[0]?.url,
        previewUrl: track.preview_url,
        spotifyId: track.id,
        durationMs: track.duration_ms,
        energy,
        valence
      };
    }
  } catch (e) {
    console.error('[Spotify] Enrichment failed for', isrc, e);
  }

  return {};
}

export async function getSpotifyTrackMetadata(spotifyId: string) {
  if (!flags.spotifyEnrichment) {
    return null;
  }
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });
    
    if (!tokenRes.ok) throw new Error('Spotify auth failed');
    const { access_token } = await tokenRes.json();

    const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    if (!trackRes.ok) throw new Error('Spotify track failed');
    const track = await trackRes.json();
    
    return {
      isrc: track.external_ids?.isrc,
      title: track.name,
      artist: track.artists?.[0]?.name,
    };
  } catch (e) {
    console.error('[Spotify] Metadata failed for', spotifyId, e);
    return null;
  }
}
