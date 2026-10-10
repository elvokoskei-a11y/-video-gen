import path from "path";
import fs from "fs";

// ─── Font Registry ────────────────────────────────────────────────────────────
// Bundled fonts for FFmpeg caption rendering.
// Eliminates dependency on host system fonts across local dev, Railway, and CI.
//
// License: Inter is licensed under the SIL Open Font License 1.1
// See: FONTS.md at the project root for full license information.

export interface FontEntry {
  family: string;
  weight: "regular" | "bold" | "semibold";
  path: string;     // absolute path on disk
  license: string;
  available: boolean;
}

// Font files are located in assets/fonts/ relative to project root.
// In production (Railway), the working directory is /app.
function resolveAssetPath(relativePath: string): string {
  // Try process.cwd() first (Next.js + Railway)
  const cwdPath = path.join(process.cwd(), relativePath);
  if (fs.existsSync(cwdPath)) return cwdPath;

  // Fallback: __dirname-relative (compiled output)
  const dirPath = path.join(__dirname, "..", "..", "..", relativePath);
  if (fs.existsSync(dirPath)) return dirPath;

  // Return the cwd path even if not found — error will surface at render time
  return cwdPath;
}

// The font registry is built at module load time.
// Availability is checked by verifying the file exists.
function buildRegistry(): FontEntry[] {
  const entries: FontEntry[] = [
    {
      family: "Inter",
      weight: "regular",
      path: resolveAssetPath("assets/fonts/Inter-Regular.ttf"),
      license: "SIL Open Font License 1.1",
      available: false,
    },
    {
      family: "Inter",
      weight: "bold",
      path: resolveAssetPath("assets/fonts/Inter-Bold.ttf"),
      license: "SIL Open Font License 1.1",
      available: false,
    },
  ];

  for (const entry of entries) {
    entry.available = fs.existsSync(entry.path);
    if (!entry.available) {
      console.warn(
        `[FontRegistry] Font not found: ${entry.path}. ` +
        `Caption rendering will fail. Ensure assets/fonts/ is included in deployment.`
      );
    }
  }

  return entries;
}

const FONT_REGISTRY = buildRegistry();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the absolute path to a font file for use in FFmpeg drawtext.
 * Falls back to the bundled default if the requested variant is unavailable.
 * Never returns a system font path.
 *
 * @throws Error if NO bundled fonts are available at all.
 */
export function getFontPath(
  family: string = "Inter",
  weight: "regular" | "bold" | "semibold" = "regular"
): string {
  // Find requested font
  const requested = FONT_REGISTRY.find(
    (f) => f.family === family && f.weight === weight && f.available
  );
  if (requested) return requested.path;

  // Fallback: any available Inter variant
  const fallback = FONT_REGISTRY.find((f) => f.family === "Inter" && f.available);
  if (fallback) {
    console.warn(
      `[FontRegistry] Font ${family}/${weight} unavailable. ` +
      `Using fallback: ${fallback.family}/${fallback.weight}`
    );
    return fallback.path;
  }

  // Last resort: any available font
  const anyFont = FONT_REGISTRY.find((f) => f.available);
  if (anyFont) {
    console.warn(
      `[FontRegistry] Requested font unavailable. Using first available: ${anyFont.path}`
    );
    return anyFont.path;
  }

  throw new Error(
    "No bundled fonts are available. " +
    "Ensure assets/fonts/Inter-Regular.ttf exists. " +
    "See FONTS.md for setup instructions."
  );
}

export function getBoldFontPath(): string {
  return getFontPath("Inter", "bold");
}

export function isFontAvailable(family: string = "Inter"): boolean {
  return FONT_REGISTRY.some((f) => f.family === family && f.available);
}

export function listAvailableFonts(): FontEntry[] {
  return FONT_REGISTRY.filter((f) => f.available);
}

export function getFontRegistryStatus(): {
  allAvailable: boolean;
  fonts: Array<{ name: string; available: boolean; path: string }>;
} {
  return {
    allAvailable: FONT_REGISTRY.every((f) => f.available),
    fonts: FONT_REGISTRY.map((f) => ({
      name: `${f.family} ${f.weight}`,
      available: f.available,
      path: f.path,
    })),
  };
}
