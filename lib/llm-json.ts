export function safeParseJson<T = unknown>(rawText: string): T | null {
  if (!rawText || typeof rawText !== "string") return null;

  const trimmed = rawText.trim();
  const withoutFences = stripCodeFences(trimmed);

  try {
    return JSON.parse(withoutFences) as T;
  } catch {
    // Continue to object extraction fallback.
  }

  const extracted = extractFirstJsonObject(withoutFences);
  if (!extracted) return null;

  try {
    return JSON.parse(extracted) as T;
  } catch {
    return null;
  }
}

function stripCodeFences(text: string): string {
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return text;
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1).trim();
      }
    }
  }

  return null;
}
