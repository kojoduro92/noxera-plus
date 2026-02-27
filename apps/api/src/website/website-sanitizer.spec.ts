import { isIframeHostAllowlisted, sanitizeHtmlFragment } from './website-sanitizer';

describe('website-sanitizer', () => {
  it('removes scripts, event handlers, and javascript urls', () => {
    const input = `
      <div onclick="alert(1)">
        <a href="javascript:alert('x')">Click</a>
        <script>alert("xss")</script>
      </div>
    `;

    const sanitized = sanitizeHtmlFragment(input);

    expect(sanitized.sanitizedHtml).not.toContain('<script');
    expect(sanitized.sanitizedHtml).not.toContain('onclick=');
    expect(sanitized.sanitizedHtml).not.toContain('javascript:');
    expect(sanitized.warnings.length).toBeGreaterThan(0);
  });

  it('keeps iframe embeds from allowlisted hosts and strips non-allowlisted hosts', () => {
    const input = `
      <iframe src="https://www.youtube.com/embed/abc123" style="width:100%"></iframe>
      <iframe src="https://evil.example.com/embed/abc"></iframe>
    `;

    const sanitized = sanitizeHtmlFragment(input);

    expect(sanitized.sanitizedHtml).toContain('www.youtube.com');
    expect(sanitized.sanitizedHtml).not.toContain('evil.example.com');
    expect(sanitized.warnings.some((warning) => warning.includes('allowlisted'))).toBe(true);
  });

  it('exposes host allowlist helper', () => {
    expect(isIframeHostAllowlisted('https://www.youtube.com/embed/abc123')).toBe(true);
    expect(isIframeHostAllowlisted('https://not-allowed.example.com/embed/abc123')).toBe(false);
  });
});
