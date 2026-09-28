# Credits — third-party assets

## Emoji artwork

The Unicode emoji picker offers three artwork sets. They are **not** loaded from a
third-party CDN: each set is seeded into the instance's own object store (nebula) and served
from `<instance>/cdn/v1/emoji/<set>/…`, so rendering an emoji never leaks a viewer's IP or
referrer to an outside host and an air-gapped instance still renders every emoji. The
picker also offers a **System** option that uses the OS font and fetches nothing at all.

The set → URL mapping lives in [`src/lib/emoji/providers.ts`](src/lib/emoji/providers.ts)
(`EMOJI_ATTRIBUTIONS`), which is the source of truth for the in-app attribution shown under
Settings → Appearance → Emoji. The pinned versions and the fetch that populates nebula live
in the nebula repo (`scripts/fetch-emoji.sh`).

| Set | Upstream | Licence | Notes |
| --- | --- | --- | --- |
| **Twemoji** (default) | [jdecked/twemoji](https://github.com/jdecked/twemoji) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Attribution required (this file + in-app credit). Code is MIT; the **graphics** are CC-BY 4.0. |
| **Noto Emoji** | [googlefonts/noto-emoji](https://github.com/googlefonts/noto-emoji) | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) | Licence notice preserved in the seeded `LICENSE`. |
| **OpenMoji** | [openmoji.org](https://openmoji.org) | [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Attribution **and** ShareAlike. |

If you add, remove, or re-version a set, update `EMOJI_ATTRIBUTIONS`, this table, and the
nebula fetch script together so the credit, the licence, and the shipped bytes stay in step.
