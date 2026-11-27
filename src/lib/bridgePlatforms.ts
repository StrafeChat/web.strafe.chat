import { isBridgePlatform } from '../api/bridges';
import { t } from '../i18n';

/**
 * How a bridge's platform is named and pictured. The name is a brand ("Discord", "Matrix")
 * and so the same in every language; `other` shows the bridge's own `platform_name`
 * ("Mastodon"), and falls back to "Other platform".
 */
export function bridgePlatformLabel(platform: string | undefined | null, platformName?: string | null): string {
  const custom = (platformName ?? '').trim();
  if (platform === 'other' || !isBridgePlatform(platform)) return custom || t('badges.platform.other');
  return t(`badges.platform.${platform}`);
}

/** Where "Learn more" about bridges points: the docs every instance serves, the part about
 * what a bridge copies and how a person opts out. */
export const BRIDGES_LEARN_MORE = '/docs/rest/#bridges-and-privacy';

/** A Font Awesome class for the platform where one exists, else the bridge glyph. */
export function bridgePlatformIcon(platform: string | undefined | null): string {
  switch (platform) {
    case 'discord':
      return 'fa-brands fa-discord';
    case 'telegram':
      return 'fa-brands fa-telegram';
    case 'slack':
      return 'fa-brands fa-slack';
    default:
      return 'fa-solid fa-bridge';
  }
}

/** `#rrggbb` for a masquerade colour (0xRRGGBB), or undefined. */
export function masqueradeColourHex(colour: number | undefined | null): string | undefined {
  if (typeof colour !== 'number' || !Number.isFinite(colour) || colour <= 0) return undefined;
  return `#${(Math.floor(colour) % 0x1000000).toString(16).padStart(6, '0')}`;
}

/** Name skeleton for the "Not the Strafe account @x" check: case-folded, compatibility-
 * normalised, invisible and combining marks gone, whitespace collapsed - close to the server's
 * own rule (spec 5.4), so "Ａlice" and "alice" are the same name here too. */
export function nameSkeleton(name: string | undefined | null): string {
  return (name ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff\u00ad]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
