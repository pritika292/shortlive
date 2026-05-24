// Static ISO 3166-1 alpha-2 → flag-emoji lookup.
//
// The previous approach combined two regional indicator code points
// (`String.fromCodePoint(0x1f1e6 + offset) * 2`) and relied on the OS font
// to render the pair as a flag. macOS / iOS do; Windows + many Linux
// builds + Chrome on those don't, so users saw the raw two-letter
// regional indicators ("US", "DE") instead of flags.
//
// A pre-composed map is verbose but renders identically on every platform.

const FLAGS: Record<string, string> = {
  AE: "🇦🇪",
  AR: "🇦🇷",
  AT: "🇦🇹",
  AU: "🇦🇺",
  BE: "🇧🇪",
  BG: "🇧🇬",
  BR: "🇧🇷",
  CA: "🇨🇦",
  CH: "🇨🇭",
  CL: "🇨🇱",
  CN: "🇨🇳",
  CO: "🇨🇴",
  CZ: "🇨🇿",
  DE: "🇩🇪",
  DK: "🇩🇰",
  EG: "🇪🇬",
  ES: "🇪🇸",
  FI: "🇫🇮",
  FR: "🇫🇷",
  GB: "🇬🇧",
  GR: "🇬🇷",
  HK: "🇭🇰",
  HU: "🇭🇺",
  ID: "🇮🇩",
  IE: "🇮🇪",
  IL: "🇮🇱",
  IN: "🇮🇳",
  IT: "🇮🇹",
  JP: "🇯🇵",
  KE: "🇰🇪",
  KR: "🇰🇷",
  MA: "🇲🇦",
  MX: "🇲🇽",
  MY: "🇲🇾",
  NG: "🇳🇬",
  NL: "🇳🇱",
  NO: "🇳🇴",
  NZ: "🇳🇿",
  PE: "🇵🇪",
  PH: "🇵🇭",
  PK: "🇵🇰",
  PL: "🇵🇱",
  PT: "🇵🇹",
  RO: "🇷🇴",
  RU: "🇷🇺",
  SA: "🇸🇦",
  SE: "🇸🇪",
  SG: "🇸🇬",
  TH: "🇹🇭",
  TR: "🇹🇷",
  TW: "🇹🇼",
  UA: "🇺🇦",
  US: "🇺🇸",
  VN: "🇻🇳",
  ZA: "🇿🇦",
};

export function flagFor(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "🌐";
  return FLAGS[code.toUpperCase()] ?? "🌐";
}
