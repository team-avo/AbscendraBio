// Parser for ION Peptide order-confirmation emails.
//
// Expected layout (from observed templates):
//   - Subject mentions the order; body header reads "Order #NNNNNN (Date)"
//   - "Order summary" table with columns: Product | Quantity | Price
//   - Quantity cells render as "×N" (multiplication sign) for N units
//   - Price cells render as "$X,XXX.XX"
//
// This parser is tolerant of minor markup changes: it scans every table row
// for the (product-name, ×qty, $price) shape rather than assuming a fixed
// number of leading columns.

const cheerio = require("cheerio");
const { ParseError } = require("./index-shared");

const QUANTITY_RE = /[×x]\s*(\d{1,6})\b/; // matches "×60" or "x 60"
const PRICE_RE = /\$\s?[\d,]+(?:\.\d{2})?/;
const ORDER_NUMBER_RE = /Order\s*#\s*([A-Z0-9-]{3,})/i;

function cleanText(s) {
  return (s || "")
    .replace(/\s+/g, " ")
    .replace(/ /g, " ")
    .trim();
}

function extractOrderNumber($, allText) {
  const match = allText.match(ORDER_NUMBER_RE);
  if (match) return match[1];
  // Fallback: look for "Order Number: XXXX" style
  const alt = allText.match(/order\s*(?:number|no\.?)\s*[:#]?\s*([A-Z0-9-]{3,})/i);
  return alt ? alt[1] : null;
}

function parse(html) {
  if (!html || typeof html !== "string") {
    throw new ParseError("Empty HTML body");
  }

  const $ = cheerio.load(html);
  const allText = cleanText($("body").text() || $.root().text());

  const orderNumber = extractOrderNumber($, allText);
  const lines = [];

  // Iterate every row in every table — supplier templates often nest tables.
  $("tr").each((_, row) => {
    const $row = $(row);
    const cellTexts = $row
      .children("td,th")
      .map((__, td) => cleanText($(td).text()))
      .get()
      .filter((t) => t.length > 0);

    if (cellTexts.length < 2) return;

    // Find quantity cell ("×60") and price cell ("$1,234.00") — these anchor a line item row.
    let qtyIdx = -1;
    let priceIdx = -1;
    let qty = null;

    for (let i = 0; i < cellTexts.length; i++) {
      const text = cellTexts[i];
      if (qtyIdx === -1) {
        const m = text.match(QUANTITY_RE);
        if (m && text.length <= 12) {
          qty = parseInt(m[1], 10);
          qtyIdx = i;
          continue;
        }
      }
      if (priceIdx === -1 && PRICE_RE.test(text)) {
        priceIdx = i;
      }
    }

    if (qty == null || qtyIdx === -1) return;

    // Skip header rows: "Product" / "Quantity" / "Price"
    if (cellTexts.some((t) => /^quantity$/i.test(t))) return;

    // Product name = the cells before the qty cell, joined.
    const nameCells = cellTexts.slice(0, qtyIdx).filter((t) => {
      // Drop image-only alt text or empty strings
      if (!t) return false;
      if (PRICE_RE.test(t)) return false;
      if (QUANTITY_RE.test(t) && t.length <= 12) return false;
      return true;
    });

    if (nameCells.length === 0) return;

    const supplierProductName = nameCells.join(" ").trim();
    if (!supplierProductName) return;

    lines.push({
      supplierProductName,
      parsedQuantity: qty,
    });
  });

  return {
    orderNumber,
    lines,
  };
}

module.exports = { parse };
