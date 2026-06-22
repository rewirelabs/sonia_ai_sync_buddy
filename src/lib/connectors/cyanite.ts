import { flags } from '../config/flags';

const CYANITE_URL = 'https://api.cyanite.ai/graphql';

async function fetchCyanite(query: string, variables: any) {
  const token = process.env.CYANITE_API_KEY || process.env.CYANITE_ACCESS_TOKEN;
  if (!token) throw new Error("Missing Cyanite API Key");
  
  const res = await fetch(CYANITE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (data.errors) {
    console.error('[Cyanite] GraphQL errors:', data.errors);
    throw new Error('Cyanite API error');
  }
  return data.data;
}

export async function getCyaniteCurve(spotifyId: string) {
  if (!flags.cyaniteSoundCurve) {
    return null;
  }

  try {
    console.log(`[Cyanite] Enqueueing Spotify track: ${spotifyId}`);
    const enqueueMutation = `
      mutation($spotifyId: ID!) {
        spotifyTrackEnqueue(input: { spotifyTrackId: $spotifyId }) {
          ... on SpotifyTrackEnqueueSuccess {
            enqueuedSpotifyTrack {
              id
            }
          }
        }
      }
    `;
    const enqueueRes = await fetchCyanite(enqueueMutation, { spotifyId });
    const trackId = enqueueRes.spotifyTrackEnqueue?.enqueuedSpotifyTrack?.id;
    if (!trackId) {
      console.warn('[Cyanite] Could not enqueue track (perhaps rate limit or invalid ID):', spotifyId);
      return null;
    }

    console.log(`[Cyanite] Polling status for track: ${spotifyId}`);
    let status = '';
    let attempt = 0;
    // 15 attempts * 3 seconds = 45 seconds timeout
    while (status !== 'AudioAnalysisV6Finished' && status !== 'AudioAnalysisV6Failed' && status !== 'AudioAnalysisV6NotAuthorized' && attempt < 15) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 3000));
      attempt++;
      
      const statusQuery = `
        query($id: ID!) {
          spotifyTrack(id: $id) {
            ... on SpotifyTrack {
              audioAnalysisV6 { __typename }
            }
          }
        }
      `;
      // Passing spotifyId here instead of trackId, just in case Cyanite expects the Spotify ID
      const statusRes = await fetchCyanite(statusQuery, { id: spotifyId });
      status = statusRes.spotifyTrack?.audioAnalysisV6?.__typename || 'unknown';
      console.log(`[Cyanite] Polled status attempt ${attempt}:`, status);
    }

    if (status === 'AudioAnalysisV6NotAuthorized') {
      console.warn(`[Cyanite] API KEY IS NOT AUTHORIZED FOR V6 ANALYSIS. Please upgrade your Cyanite plan.`);
      return null;
    }

    if (status !== 'AudioAnalysisV6Finished') {
      console.warn(`[Cyanite] Analysis skipped (status: ${status}). Taking too long or failed for ${spotifyId}. Falling back to default data to preserve fast UX.`);
      return null;
    }

    console.log(`[Cyanite] Analysis finished, fetching results...`);
    const resultQuery = `
      query($id: ID!) {
        spotifyTrack(id: $id) {
          ... on SpotifyTrack {
            audioAnalysisV6 {
              ... on AudioAnalysisV6Finished {
                result {
                  energy { level }
                  mood { valence, energy }
                }
              }
            }
          }
        }
      }
    `;
    const res = await fetchCyanite(resultQuery, { id: spotifyId });
    return res.spotifyTrack?.audioAnalysisV6?.result;

  } catch (error) {
    console.error('[Cyanite] Error:', error);
    return null;
  }
}

export async function searchCyaniteByFreeText(brief: string) {
  try {
    const query = `
      query($keyword: String!) {
        freeTextSearch(
          searchText: $keyword,
          target: { spotify: {} },
          first: 30
        ) {
          ... on FreeTextSearchConnection {
            edges {
              node {
                ... on SpotifyTrack {
                  id
                }
              }
            }
          }
        }
      }
    `;
    const res = await fetchCyanite(query, { keyword: brief });
    if (!res.freeTextSearch || !res.freeTextSearch.edges) {
      return [];
    }
    return res.freeTextSearch.edges.map((e: any) => ({
      spotifyId: e.node.id
    }));
  } catch (error: any) {
    // Check if error is related to authorization or subscription plan
    if (error.message && error.message.includes('Not Authorized') || error.message.includes('forbidden')) {
      console.log('⚠️ [Cyanite Discovery] FreeTextSearch non autorizzata (forse limitata dal piano). Salto questo step e procedo con gli altri.');
    } else {
      console.error('[Cyanite Discovery] Failed:', error);
    }
    return [];
  }
}
