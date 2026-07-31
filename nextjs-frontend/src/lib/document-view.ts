/**
 * Helpers for opening server-rendered documents (invoice / packing slip) so the
 * user can VIEW them in a new browser tab. The tab stays open — no auto-print and
 * no auto-close — and a small floating "Print / Save PDF" button (hidden when
 * printing) lets the user print on demand instead of being forced into a print
 * dialog they can't dismiss without losing the page.
 */

/**
 * Sanitizes a fetched document's HTML and injects the floating print toolbar.
 * - Replaces CSS color functions some print engines can't parse (oklch/lab/...).
 * - Adds an on-screen-only "Print / Save PDF" button and print color-fidelity CSS.
 */
export function buildViewableDocument(html: string): string {
  let out = html;
  out = out.replace(/(?:oklch|oklab|lab|lch|hwb)\s*\([^)]*\)/gi, '#000000');
  out = out.replace(/--[a-zA-Z0-9-]+:\s*(?:oklch|oklab|lab|lch|hwb)\s*\([^;]+\);/gi, '');

  const toolbar = `
    <style>
      @media screen {
        .__doc-toolbar {
          position: fixed; top: 14px; right: 14px; z-index: 99999;
          font-family: Arial, sans-serif;
        }
        .__doc-toolbar button {
          background: #043061; color: #fff; border: none; border-radius: 8px;
          padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
          box-shadow: 0 2px 10px rgba(0,0,0,0.18);
        }
        .__doc-toolbar button:hover { background: #0b4f96; }
      }
      @media print {
        .__doc-toolbar { display: none !important; }
        html, body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
      }
    </style>
    <div class="__doc-toolbar">
      <button type="button" onclick="window.print()">Print / Save PDF</button>
    </div>
  `;

  if (out.includes('</body>')) {
    out = out.replace('</body>', toolbar + '</body>');
  } else {
    out = out + toolbar;
  }
  return out;
}

/**
 * Opens the given document HTML in a new, persistent tab for viewing.
 * Returns false if the popup was blocked (caller should surface an error).
 */
export function openDocumentInTab(html: string): boolean {
  const viewWindow = window.open('', '_blank');
  if (!viewWindow) return false;
  viewWindow.document.open();
  viewWindow.document.write(buildViewableDocument(html));
  viewWindow.document.close();
  return true;
}
