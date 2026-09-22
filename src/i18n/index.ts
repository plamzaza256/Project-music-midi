import en from "./en.json";
import th from "./th.json";

export type Locale = "en" | "th";

export type Dict = typeof en;

const dictionaries: Record<Locale, Dict> = { en, th };

/** Deep-path lookup helper: get(dict, "landing.hero.title1") */
function get(obj: unknown, path: string): string {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  return typeof cur === "string" ? cur : path;
}

export function getDict(locale: Locale): Dict {
  return dictionaries[locale] ?? dictionaries.en;
}

/** Translate a dot-path key into the active locale's string. */
export function t(locale: Locale, key: string): string {
  return get(getDict(locale), key);
}
