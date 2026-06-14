import sanitize from "sanitize-html";

const ALLOWED_TAGS = [
    "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "p", "a", "ul", "ol",
    "nl", "li", "b", "i", "strong", "em", "strike", "code", "hr", "br", "div",
    "table", "thead", "caption", "tbody", "tr", "th", "td", "pre", "img", "span",
    "iframe", "noscript",
];

const ALLOWED_ATTR = [
    "href", "name", "target", "src", "alt", "title", "class", "style",
    "width", "height", "frameborder", "allowfullscreen", "id", "type", "suppressHydrationWarning",
];

/**
 * Sanitizes an HTML string to prevent XSS attacks.
 *
 * Uses sanitize-html, a pure-JS sanitizer that runs identically on the server
 * and the client. (We intentionally avoid isomorphic-dompurify here: it pulls
 * in jsdom, whose dependency tree ships ESM-only modules that Vercel's
 * serverless module loader cannot require(), which 500s every SSR route.)
 *
 * @param html The raw HTML string to sanitize
 * @returns The sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
    if (!html) return "";

    return sanitize(html, {
        allowedTags: ALLOWED_TAGS,
        // Apply the same attribute allowlist to every tag, matching the previous behaviour.
        allowedAttributes: { "*": ALLOWED_ATTR },
        // Keep inline styles unfiltered (matches the previous DOMPurify config).
        allowedStyles: undefined,
        allowedSchemes: ["http", "https", "mailto", "tel", "data"],
        allowedSchemesByTag: { img: ["http", "https", "data"] },
        allowProtocolRelative: true,
    });
}
