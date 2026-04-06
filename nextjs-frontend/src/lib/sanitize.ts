import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes an HTML string to prevent XSS attacks.
 * Uses isomorphic-dompurify which works on both client and server.
 * 
 * @param html The raw HTML string to sanitize
 * @returns The sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
    if (!html) return '';

    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
            'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
            'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'img', 'span',
            'iframe', 'noscript'
        ],
        ALLOWED_ATTR: [
            'href', 'name', 'target', 'src', 'alt', 'title', 'class', 'style',
            'width', 'height', 'frameborder', 'allowfullscreen', 'id', 'type', 'suppressHydrationWarning'
        ],
        // Add custom configuration here if needed
    }) as string;
}
