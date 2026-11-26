export type JsonTokenKind = "key" | "string" | "number" | "literal";

export interface JsonToken {
  text: string;
  /** Unset for punctuation and whitespace. */
  kind?: JsonTokenKind;
}

const TOKEN =
  /("(?:[^"\\\n]|\\.)*")(?=\s*:)|("(?:[^"\\\n]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

/**
 * Splits JSON text into tokens for syntax highlighting. Works on text that is not valid JSON,
 * such as a payload cut off mid-string: what it can't recognise stays plain text.
 */
export function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let last = 0;
  for (const match of json.matchAll(TOKEN)) {
    if (match.index > last) tokens.push({ text: json.slice(last, match.index) });
    const [text, key, string, number] = match;
    const kind = key ? "key" : string ? "string" : number ? "number" : "literal";
    tokens.push({ text, kind });
    last = match.index + text.length;
  }
  if (last < json.length) tokens.push({ text: json.slice(last) });
  return tokens;
}
