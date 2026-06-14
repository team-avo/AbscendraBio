/**
 * Renders a print-ready vial label PDF by merging a lot's data and the COA QR
 * onto a brand's base label artwork, using the template's placeholder zones.
 *
 * Zone coordinates are in PDF points, top-left origin (intuitive for the editor):
 *   zones = {
 *     qr:        { x, y, w, h },
 *     lotNumber: { x, y, size, bold },
 *     mfgDate:   { x, y, size },
 *     expDate:   { x, y, size }
 *   }
 */
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

const MM_TO_PT = 2.834645669;

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function renderLabel({ coa, lot, template }) {
  const pdf = await PDFDocument.create();
  const wPt = (template.widthMm || 50) * MM_TO_PT;
  const hPt = (template.heightMm || 25) * MM_TO_PT;
  const page = pdf.addPage([wPt, hPt]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Background artwork (PNG or JPG)
  if (template.artworkUrl) {
    const bytes = await fetchBytes(template.artworkUrl);
    let img;
    try {
      img = await pdf.embedPng(bytes);
    } catch {
      img = await pdf.embedJpg(bytes);
    }
    page.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
  }

  const zones = template.zones || {};
  const toY = (yTop, h = 0) => hPt - yTop - h; // convert top-left to pdf bottom-left

  // QR code
  if (zones.qr && coa.qrCodeUrl) {
    const qrBytes = await fetchBytes(coa.qrCodeUrl);
    const qrImg = await pdf.embedPng(qrBytes);
    const z = zones.qr;
    const w = z.w;
    const h = z.h || z.w;
    page.drawImage(qrImg, { x: z.x, y: toY(z.y, h), width: w, height: h });
  }

  const drawText = (zone, value) => {
    if (!zone || value == null || value === "") return;
    const size = zone.size || 8;
    page.drawText(String(value), {
      x: zone.x,
      y: toY(zone.y, size),
      size,
      font: zone.bold ? bold : font,
      color: rgb(0, 0, 0),
    });
  };
  const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

  drawText(zones.lotNumber, lot.lotNumber);
  drawText(zones.mfgDate, fmt(lot.mfgDate));
  drawText(zones.expDate, fmt(lot.expirationDate));

  return Buffer.from(await pdf.save());
}

module.exports = { renderLabel, MM_TO_PT };
