const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

// POST /api/products/bulk-upload
// Accepts { rows: Array<ExcelMappedRow> } parsed on the client
router.post("/bulk-upload", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: "No rows provided" });
    }

    const created = [];
    // helper slug
    const slugify = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    for (const row of rows) {
      try {
        // Normalize keys: trim and lowercase for resilient matching
        const nk = Object.fromEntries(
          Object.entries(row).map(([k, v]) => [String(k).trim().toLowerCase(), v])
        );

        const name = (row["Product Name"] || row["Product name"] || nk["product name"] || nk["product name:"] || "").toString().trim();
        if (!name) continue;

        const description = (row["Product Description"] || row["description"] || nk["product description"] || "").toString().trim();
        const categoriesCsv = row["Product Category"] || nk["product category"] || row["Categories (comma)"] || nk["categories (comma)"] || "";
        const tagsCsv = row["Tags (comma)"] || nk["tags (comma)"] || "";
        const imageName = (row["Image Name"] || nk["image name"] || row["Image"] || nk["image"] || "").toString().trim();
        const idealFor = (row["IdealFor"] || nk["idealfor"] || "").toString().trim() || null;
        const keyBenefits = (row["KeyBenefits"] || nk["keybenefits"] || "").toString().trim() || null;
        const taxPercentage = (row["Tax Percentage"] ?? nk["tax percentage"]) !== undefined && (row["Tax Percentage"] ?? nk["tax percentage"]) !== ""
          ? parseFloat(row["Tax Percentage"] ?? nk["tax percentage"]) : null;

        // Detect new multi-variant format
        const hasMultiVariant = Object.keys(nk).some((k) => /^(variant\d+\s*name|variant\d+\s*price\s*b2c|variant\d+\s*price\s*b2b)$/i.test(String(k)));

        let product = await prisma.product.findFirst({ where: { name } });

        if (hasMultiVariant) {
          // Build variants from up to 6 columns
          const variantDefs = [];
          for (let i = 1; i <= 6; i++) {
            const vn = nk[`variant${i} name`] || nk[`variant ${i} name`] || row[`Variant${i} Name`] || row[`Variant ${i} Name`];
            const vB2C = nk[`variant${i} price b2c`] || nk[`variant ${i} price b2c`] || row[`Variant${i} Price B2C`] || row[`Variant ${i} Price B2C`];
            const vB2B = nk[`variant${i} price b2b`] || nk[`variant ${i} price b2b`] || row[`Variant${i} Price B2B`] || row[`Variant ${i} Price B2B`];
            const vName = vn ? String(vn).trim() : "";
            if (!vName) continue;
            const priceB2C = vB2C !== undefined && vB2C !== "" ? parseFloat(vB2C) : null;
            const priceB2B = vB2B !== undefined && vB2B !== "" ? parseFloat(vB2B) : null;
            const regularPrice = priceB2C ?? priceB2B ?? 0;
            const segPrices = [];
            if (priceB2C != null) segPrices.push({ customerType: "B2C", regularPrice: priceB2C, salePrice: null });
            if (priceB2B != null) segPrices.push({ customerType: "B2B", regularPrice: priceB2B, salePrice: null });
            const sku = `${slugify(name)}-${slugify(vName)}-${(Date.now().toString().slice(-6))}`;
            const vImageUrl = imageName ? `/products/${imageName}` : null;
            variantDefs.push({ sku, name: vName, regularPrice, segPrices, vImageUrl });
          }

          if (variantDefs.length === 0) {
            // Nothing to create, skip row
            continue;
          }

          if (!product) {
            product = await prisma.product.create({
              data: {
                name,
                description,
                status: "ACTIVE",
                categories: {
                  create: String(categoriesCsv)
                    .split(",")
                    .map((c) => String(c).trim())
                    .filter(Boolean)
                    .map((name) => ({ name })),
                },
                tags: {
                  create: String(tagsCsv)
                    .split(",")
                    .map((t) => String(t).trim())
                    .filter(Boolean)
                    .map((tag) => ({ tag })),
                },
                images: imageName
                  ? { create: [{ url: `/products/${imageName}`, altText: name, sortOrder: 0 }] }
                  : undefined,
                variants: {
                  create: variantDefs.map((vd) => ({
                    sku: vd.sku,
                    name: vd.name,
                    description: null,
                    regularPrice: vd.regularPrice,
                    salePrice: null,
                    hsn: null,
                    weight: null,
                    idealFor,
                    keyBenefits,
                    taxName: null,
                    taxPercentage,
                    isActive: true,
                    segmentPrices: { create: vd.segPrices },
                    images: vd.vImageUrl ? { create: [{ url: vd.vImageUrl, altText: vd.name, sortOrder: 0 }] } : undefined,
                  })),
                },
              },
              include: { variants: { include: { segmentPrices: true, images: true } }, images: true, categories: true, tags: true },
            });
            created.push(product);
          } else {
            for (const vd of variantDefs) {
              const exists = await prisma.productVariant.findFirst({ where: { sku: vd.sku } });
              if (exists) continue;
              await prisma.productVariant.create({
                data: {
                  productId: product.id,
                  sku: vd.sku,
                  name: vd.name,
                  description: null,
                  regularPrice: vd.regularPrice,
                  salePrice: null,
                  hsn: null,
                  weight: null,
                  idealFor,
                  keyBenefits,
                  taxName: null,
                  taxPercentage,
                  isActive: true,
                  segmentPrices: { create: vd.segPrices },
                  images: vd.vImageUrl ? { create: [{ url: vd.vImageUrl, altText: vd.name, sortOrder: 0 }] } : undefined,
                },
              });
            }
            created.push(product);
          }
        } else {
          // Fallback to legacy single-variant format
          const variantSku = (row["Variant SKU"] || "").trim();
          const variantName = (row["Variant Name"] || "").trim();
          const variantDescription = (row["Variant Description"] || "").trim();
          const regularPrice = parseFloat(row["Regular Price"]) || 0;
          const salePrice = row["Sale Price"] !== undefined && row["Sale Price"] !== "" ? parseFloat(row["Sale Price"]) : null;
          const hsn = (row["HSN"] || "").trim() || null;
          const weight = row["Weight"] !== undefined && row["Weight"] !== "" ? parseFloat(row["Weight"]) : null;
          const taxName = (row["Tax Name"] || "").trim() || null;
          const seoTitle = (row["Variant SEO Title"] || "").trim() || null;
          const seoDescription = (row["Variant SEO Description"] || "").trim() || null;
          const seoSlug = (row["Variant SEO Slug"] || "").trim() || null;
          const optionsStr = (row["Variant Options (name:value | separated)"] || "").trim();
          const variantOptions = optionsStr
            ? optionsStr
              .split("|")
              .map((pair) => {
                const [n, v] = String(pair)
                  .split(":")
                  .map((s) => String(s || "").trim());
                return n && v ? { name: n, value: v } : null;
              })
              .filter(Boolean)
            : [];

          const segmentPrices = [];
          const b2cReg = row["B2C Regular Price"]; const b2cSale = row["B2C Sale Price"];
          const b2bReg = row["B2B Regular Price"]; const b2bSale = row["B2B Sale Price"];
          const entReg = row["ENTERPRISE Regular Price"]; const entSale = row["ENTERPRISE Sale Price"];
          if (b2cReg !== undefined && b2cReg !== "") segmentPrices.push({ customerType: "B2C", regularPrice: parseFloat(b2cReg), salePrice: b2cSale ? parseFloat(b2cSale) : null });
          if (b2bReg !== undefined && b2bReg !== "") segmentPrices.push({ customerType: "B2B", regularPrice: parseFloat(b2bReg), salePrice: b2bSale ? parseFloat(b2bSale) : null });
          if (entReg !== undefined && entReg !== "") segmentPrices.push({ customerType: "ENTERPRISE_1", regularPrice: parseFloat(entReg), salePrice: entSale ? parseFloat(entSale) : null });

          if (!variantSku) continue;

          if (!product) {
            product = await prisma.product.create({
              data: {
                name,
                description,
                status: "ACTIVE",
                categories: {
                  create: String(categoriesCsv)
                    .split(",")
                    .map((c) => String(c).trim())
                    .filter(Boolean)
                    .map((name) => ({ name })),
                },
                tags: {
                  create: String(tagsCsv)
                    .split(",")
                    .map((t) => String(t).trim())
                    .filter(Boolean)
                    .map((tag) => ({ tag })),
                },
                images: imageName
                  ? { create: [{ url: `/products/${imageName}`, altText: name, sortOrder: 0 }] }
                  : undefined,
                variants: {
                  create: [
                    {
                      sku: variantSku,
                      name: variantName || name,
                      description: variantDescription || null,
                      regularPrice,
                      salePrice,
                      hsn,
                      weight,
                      idealFor,
                      keyBenefits,
                      taxName,
                      taxPercentage,
                      isActive: true,
                      seoTitle,
                      seoDescription,
                      seoSlug,
                      variantOptions: { create: variantOptions },
                      segmentPrices: { create: segmentPrices },
                    },
                  ],
                },
              },
              include: { variants: { include: { segmentPrices: true, variantOptions: true } }, categories: true, tags: true },
            });
            created.push(product);
          } else {
            const existingVariant = await prisma.productVariant.findFirst({ where: { sku: variantSku } });
            if (!existingVariant) {
              const variant = await prisma.productVariant.create({
                data: {
                  sku: variantSku,
                  productId: product.id,
                  name: variantName || name,
                  description: variantDescription || null,
                  regularPrice,
                  salePrice,
                  hsn,
                  weight,
                  idealFor,
                  keyBenefits,
                  taxName,
                  taxPercentage,
                  isActive: true,
                  seoTitle,
                  seoDescription,
                  seoSlug,
                  variantOptions: { create: variantOptions },
                  segmentPrices: { create: segmentPrices },
                },
                include: { segmentPrices: true, variantOptions: true },
              });
              created.push({ ...product, variants: [variant] });
            }
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Bulk row failed:", e);
        // continue processing other rows
      }
    }

    return res.json({ success: true, count: created.length, data: created });
  } catch (error) {
    console.error("POST /api/products/bulk-upload error", error);
    return res.status(500).json({ success: false, error: "Failed bulk upload" });
  }
});

module.exports = router;


