const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

type JsonObject = Record<string, unknown>;

function parseJsonMaybe(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function getErrorMessage(status: number, statusText: string, payload: unknown): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return `API request failed (${status} ${statusText})`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const target = (() => {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    // Internal Next API routes should stay same-origin (do not prefix backend base URL).
    if (path.startsWith("/api/")) {
      return path;
    }

    if (!API_BASE_URL) {
      return path;
    }

    return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  })();

  const response = await fetch(target, init);
  const text = await response.text();
  const payload = parseJsonMaybe(text);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(response.status, response.statusText, payload), response.status, payload);
  }

  if (payload === null) {
    throw new ApiError(`Expected JSON response from ${path}, but got non-JSON content.`, response.status, text);
  }

  return payload as T;
}

export function withJsonBody(body: JsonObject): Pick<RequestInit, "headers" | "body"> {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
