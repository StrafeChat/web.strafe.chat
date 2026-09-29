/**
 * Inline video embeds for chat link previews. A handful of providers (YouTube, Vimeo, …) don't
 * serve a playable file - they're meant to be framed - so for a known one we build the provider's
 * own `/embed` URL and play it in a sandboxed <iframe> in-app, instead of only linking out.
 *
 * Only these allow-listed hosts are ever framed (they must also be in the page CSP's `frame-src`),
 * the privacy-preserving variant is used where one exists (youtube-nocookie), and the caller loads
 * the frame lazily on click - so nothing phones home until the user actually presses play.
 */

/** A third-party video that can be played inline in an <iframe>. */
export interface VideoEmbed {
  /** The iframe src, already carrying autoplay + privacy params. */
  src: string;
  /** Human name of the provider, shown on the play affordance and used as the iframe title. */
  provider: string;
  /** Portrait players (YouTube Shorts) size to a 9:16 box instead of the default 16:9. */
  portrait?: boolean;
  /** A poster derivable from the URL alone (YouTube thumbnails), so the embed still previews when
   * the provider serves our unfurl bot no metadata. A real og:image is preferred over this. */
  poster?: string;
  /** The iframe `allow` attribute (feature-policy delegation for autoplay/fullscreen/…). */
  allow: string;
}

const PLAYER_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share';

/** Hostname without a leading www., lower-cased. */
function host(u: URL): string {
  return u.hostname.replace(/^www\./, '').toLowerCase();
}

/** Parse a YouTube start time ("90", "1m30s", "1h2m3s") into whole seconds. */
function parseStart(v: string | null): number {
  if (!v) return 0;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!m || !m[0]) return 0;
  return parseInt(m[1] || '0', 10) * 3600 + parseInt(m[2] || '0', 10) * 60 + parseInt(m[3] || '0', 10);
}

const YT_ID = /^[\w-]{11}$/;

function youtube(u: URL): VideoEmbed | null {
  const h = host(u);
  const segs = u.pathname.split('/').filter(Boolean);
  let id = '';
  let portrait = false;
  if (h === 'youtu.be') {
    id = segs[0] || '';
  } else if (h === 'youtube.com' || h === 'm.youtube.com' || h === 'music.youtube.com' || h === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
    else if (segs[0] === 'shorts') (id = segs[1] || ''), (portrait = true);
    else if (segs[0] === 'embed' || segs[0] === 'live' || segs[0] === 'v') id = segs[1] || '';
  } else {
    return null;
  }
  if (!YT_ID.test(id)) return null;
  const p = new URLSearchParams({ autoplay: '1', rel: '0', modestbranding: '1', playsinline: '1' });
  const start = parseStart(u.searchParams.get('t') || u.searchParams.get('start'));
  if (start > 0) p.set('start', String(start));
  return {
    src: `https://www.youtube-nocookie.com/embed/${id}?${p.toString()}`,
    provider: 'YouTube',
    portrait,
    poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    allow: PLAYER_ALLOW,
  };
}

function vimeo(u: URL): VideoEmbed | null {
  if (host(u) !== 'vimeo.com' && host(u) !== 'player.vimeo.com') return null;
  const segs = u.pathname.split('/').filter(Boolean);
  let id = '';
  let hash = '';
  segs.forEach((s, i) => {
    if (/^\d+$/.test(s)) {
      id = s;
      const next = segs[i + 1]; // a private video carries an unlisted hash right after its id
      hash = next && /^[a-z0-9]+$/i.test(next) && !/^\d+$/.test(next) ? next : '';
    }
  });
  if (!id) return null;
  const p = new URLSearchParams({ autoplay: '1' });
  if (hash) p.set('h', hash);
  return { src: `https://player.vimeo.com/video/${id}?${p.toString()}`, provider: 'Vimeo', allow: PLAYER_ALLOW };
}

function dailymotion(u: URL): VideoEmbed | null {
  const h = host(u);
  let id = '';
  if (h === 'dai.ly') id = (u.pathname.split('/').filter(Boolean)[0] || '').split('_')[0]!;
  else if (h === 'dailymotion.com') {
    const segs = u.pathname.split('/').filter(Boolean);
    const i = segs.indexOf('video');
    if (i >= 0) id = (segs[i + 1] || '').split('_')[0]!;
  } else return null;
  if (!/^[a-z0-9]+$/i.test(id)) return null;
  return { src: `https://www.dailymotion.com/embed/video/${id}?autoplay=1`, provider: 'Dailymotion', allow: PLAYER_ALLOW };
}

function loom(u: URL): VideoEmbed | null {
  if (host(u) !== 'loom.com') return null;
  const segs = u.pathname.split('/').filter(Boolean);
  const i = segs.indexOf('share');
  const id = i >= 0 ? segs[i + 1] : segs[0] === 'embed' ? segs[1] : '';
  if (!id || !/^[a-f0-9]{20,}$/i.test(id)) return null;
  return { src: `https://www.loom.com/embed/${id}?autoplay=1`, provider: 'Loom', allow: PLAYER_ALLOW };
}

function streamable(u: URL): VideoEmbed | null {
  if (host(u) !== 'streamable.com') return null;
  const segs = u.pathname.split('/').filter(Boolean);
  const id = segs[0] === 'e' || segs[0] === 'o' ? segs[1] : segs[0];
  if (!id || !/^[a-z0-9]+$/i.test(id)) return null;
  return { src: `https://streamable.com/e/${id}?autoplay=1`, provider: 'Streamable', allow: PLAYER_ALLOW };
}

function twitch(u: URL): VideoEmbed | null {
  const h = host(u);
  // Twitch requires the embedding page's exact hostname as `parent`, so it adapts per instance.
  const parent = typeof location !== 'undefined' ? location.hostname : 'localhost';
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...extra, parent, autoplay: 'true' }).toString();
  if (h === 'clips.twitch.tv') {
    const slug = u.pathname.split('/').filter(Boolean)[0];
    return slug ? { src: `https://clips.twitch.tv/embed?${qs({ clip: slug })}`, provider: 'Twitch', allow: PLAYER_ALLOW } : null;
  }
  if (h === 'twitch.tv') {
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs[0] === 'videos' && segs[1]) return { src: `https://player.twitch.tv/?${qs({ video: segs[1] })}`, provider: 'Twitch', allow: PLAYER_ALLOW };
    const c = segs.indexOf('clip');
    if (c >= 0 && segs[c + 1]) return { src: `https://clips.twitch.tv/embed?${qs({ clip: segs[c + 1]! })}`, provider: 'Twitch', allow: PLAYER_ALLOW };
    if (segs.length === 1 && segs[0]) return { src: `https://player.twitch.tv/?${qs({ channel: segs[0] })}`, provider: 'Twitch', allow: PLAYER_ALLOW };
  }
  return null;
}

const PROVIDERS = [youtube, vimeo, dailymotion, loom, streamable, twitch];

/** The inline <iframe> embed for a known provider URL, or null for anything not embeddable. */
export function videoEmbed(rawUrl: string | undefined): VideoEmbed | null {
  if (!rawUrl) return null;
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  for (const p of PROVIDERS) {
    const e = p(u);
    if (e) return e;
  }
  return null;
}
