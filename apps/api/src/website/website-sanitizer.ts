const ALLOWED_IFRAME_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'player.vimeo.com',
  'vimeo.com',
  'maps.google.com',
  'www.google.com',
  'open.spotify.com',
  'w.soundcloud.com',
]);

function hostAllowed(url: string) {
  try {
    const parsed = new URL(url);
    return ALLOWED_IFRAME_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function sanitizeHtmlFragment(input: string) {
  let html = input ?? '';
  const warnings: string[] = [];

  const initialScriptMatches = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi);
  if (initialScriptMatches?.length) {
    warnings.push(`Removed ${initialScriptMatches.length} script tag(s).`);
  }
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  const tagBlocklist = ['object', 'embed', 'meta', 'link', 'style', 'html', 'head', 'body'];
  for (const tag of tagBlocklist) {
    const openClose = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    const selfClosing = new RegExp(`<${tag}\\b[^>]*\\/?\\s*>`, 'gi');

    const openCloseMatches = html.match(openClose);
    const selfClosingMatches = html.match(selfClosing);
    const removed = (openCloseMatches?.length ?? 0) + (selfClosingMatches?.length ?? 0);
    if (removed > 0) {
      warnings.push(`Removed ${removed} <${tag}> tag(s).`);
      html = html.replace(openClose, '');
      html = html.replace(selfClosing, '');
    }
  }

  const eventHandlerMatches = html.match(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi);
  if (eventHandlerMatches?.length) {
    warnings.push(`Removed ${eventHandlerMatches.length} inline event handler(s).`);
  }
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  const javascriptUrlMatches = html.match(/\s(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi);
  if (javascriptUrlMatches?.length) {
    warnings.push(`Removed ${javascriptUrlMatches.length} javascript: URL attribute(s).`);
  }
  html = html.replace(/\s(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '');

  const iframePattern = /<iframe\b([^>]*)><\/iframe>/gi;
  html = html.replace(iframePattern, (match, attrs) => {
    const srcMatch = attrs.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i);
    const src = srcMatch?.[2] ?? srcMatch?.[3] ?? '';

    if (!src || !hostAllowed(src)) {
      warnings.push('Removed iframe with non-allowlisted source.');
      return '';
    }

    const cleanedAttrs = attrs
      .replace(/\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '');

    return `<iframe${cleanedAttrs}></iframe>`;
  });

  const trimmed = html.trim();
  return {
    sanitizedHtml: trimmed,
    warnings,
  };
}

export function isIframeHostAllowlisted(url: string) {
  return hostAllowed(url);
}

export const WEBSITE_EMBED_HOST_ALLOWLIST = Array.from(ALLOWED_IFRAME_HOSTS.values());
