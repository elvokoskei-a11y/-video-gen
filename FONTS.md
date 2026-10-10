# Bundled Fonts

This project bundles the following fonts for use in FFmpeg caption rendering.
Fonts are stored in `assets/fonts/` and are included in all deployment environments
(local development, Railway worker, CI) to eliminate host system font dependencies.

## Inter

| File | Weight | License |
|------|--------|---------|
| `Inter-Regular.ttf` | Regular (400) | SIL Open Font License 1.1 |
| `Inter-Bold.ttf` | Bold (700) | SIL Open Font License 1.1 |

**Source:** https://github.com/rsms/inter  
**Author:** Rasmus Andersson  
**License:** SIL Open Font License, Version 1.1  
**License URL:** https://scripts.sil.org/OFL

### Usage Rights (SIL OFL 1.1 Summary)

- ✅ Free to use in commercial products
- ✅ Embed in software, videos, and rendered output
- ✅ Modify and redistribute derivatives
- ❌ Cannot sell the font files themselves as a standalone product
- ❌ Cannot use "Inter" as the name of a derived font without permission

Full license text: https://github.com/rsms/inter/blob/master/LICENSE.txt

---

## Adding New Fonts

1. Verify the font license permits embedding in rendered video output.
2. Place `.ttf` file in `assets/fonts/`.
3. Add an entry to `src/lib/media/font-registry.ts`.
4. Update this document.
5. Commit both the font file and this document together.

**Important:** Do not use fonts from system paths (`/usr/share/fonts`, 
`C:\Windows\Fonts`, `/System/Library/Fonts`). Bundled fonts must be 
included in the repository to ensure consistent rendering across environments.
