/**
 * Generates the QR code for a COA. The QR resolves to the COA trace page
 * (public by default; set COA_TRACE_BASE_URL / COA_TRACE_INTERNAL to change).
 * The PNG is stored in S3 and the URL returned.
 */
const QRCode = require("qrcode");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client, generateS3Url } = require("../utils/s3Service");

const TRACE_BASE = (process.env.COA_TRACE_BASE_URL || process.env.FRONTEND_URL || "https://www.ascendrabio.com").replace(/\/$/, "");

// The page a scanned QR opens. Public trace page by default.
function coaTraceUrl(coa) {
  return `${TRACE_BASE}/coa/${coa.coaNumber}`;
}

async function generateCoaQr(coa) {
  const url = coaTraceUrl(coa);
  const png = await QRCode.toBuffer(url, { width: 600, margin: 1, errorCorrectionLevel: "M" });
  const key = `coa-qr/${coa.coaNumber}-${Date.now()}.png`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: png,
      ContentType: "image/png",
    }),
  );
  return generateS3Url(key);
}

module.exports = { generateCoaQr, coaTraceUrl };
