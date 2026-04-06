const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

// DELETE /api/scripts/products - delete all products and related data
router.delete("/products", async (req, res) => {
  try {
    await prisma.promotionProductRule.deleteMany({});
    await prisma.promotionCategoryRule.deleteMany({});
    await prisma.promotionVolumeTier.deleteMany({});
    await prisma.promotionUsage.deleteMany({});
    await prisma.favorite.deleteMany({});
    await prisma.productRelation.deleteMany({});
    await prisma.productTag.deleteMany({});
    await prisma.productCategory.deleteMany({});
    await prisma.productImage.deleteMany({});
    await prisma.inventoryBatch.deleteMany({});
    await prisma.inventoryMovement.deleteMany({});
    await prisma.inventory.deleteMany({});
    // cart items reference variants; delete them before variants
    await prisma.cartItem.deleteMany({});
    // order items reference variants; delete them before variants
    await prisma.orderItem.deleteMany({});
    await prisma.segmentPrice.deleteMany({});
    await prisma.variantOption.deleteMany({});
    await prisma.productVariant.deleteMany({});
    await prisma.product.deleteMany({});

    return res.json({
      success: true,
      message: "All products and related data deleted.",
    });
  } catch (error) {
    console.error("DELETE /api/scripts/products error", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to delete products" });
  }
});

// POST /api/scripts/products - add one specific product (BPC-157)
router.post("/products", async (req, res) => {
  try {
    const payload = {
      name: "BPC-157",
      description: `Repair. Restore. Resilience.
A bioregenerative peptide known for its exceptional healing properties. BPC-157 accelerates tissue repair, reduces inflammation, and enhances recovery from injuries, gut damage, and chronic pain.`,
      status: "ACTIVE",
      images: [
        {
          url: "https://via.placeholder.com/600x600?text=BPC-157",
          altText: "BPC-157",
          sortOrder: 0,
        },
      ],
      categories: ["Peptides"],
      tags: ["bpc-157", "healing", "recovery"],
      variants: [
        {
          sku: "BPC-157-5MG",
          name: "5mg Vial",
          description: "BPC-157 research peptide vial 5mg",
          regularPrice: 99.9,
          salePrice: 95.89,
          hsn: "3004",
          weight: 5.0,
          idealFor: `Accelerated injury recovery\n- Gut and digestive repair\n- Joint health and pain management`,
          keyBenefits: `Heals muscles, tendons, and ligaments\n- Reduces inflammation and pain\n- Repairs intestinal lining\n- Supports nerve regeneration and blood flow`,
          taxName: "GST",
          taxPercentage: 18.0,
          isActive: true,
          seoTitle: "BPC-157 5mg",
          seoDescription:
            "Physician Directed BPC-157 peptide with recovery benefits",
          seoSlug: "bpc-157-5mg",
          variantOptions: [{ name: "Size", value: "5mg" }],
          segmentPrices: [
            { customerType: "B2C", regularPrice: 99.9, salePrice: 95.89 },
            { customerType: "B2B", regularPrice: 95.0, salePrice: 92.0 },
            { customerType: "ENTERPRISE_1", regularPrice: 92.0, salePrice: 89.0 },
          ],
        },
      ],
    };

    const created = await prisma.product.create({
      data: {
        name: payload.name,
        description: payload.description,
        status: payload.status,
        images: {
          create: payload.images.map((img) => ({
            url: img.url,
            altText: img.altText || null,
            sortOrder: img.sortOrder ?? 0,
          })),
        },
        categories: {
          create: payload.categories.map((name) => ({ name })),
        },
        tags: {
          create: payload.tags.map((tag) => ({ tag })),
        },
        variants: {
          create: payload.variants.map((v) => ({
            sku: v.sku,
            name: v.name,
            description: v.description || null,
            regularPrice: v.regularPrice,
            salePrice: v.salePrice ?? null,
            hsn: v.hsn || null,
            weight: v.weight ?? null,
            idealFor: v.idealFor || null,
            keyBenefits: v.keyBenefits || null,
            taxName: v.taxName || null,
            taxPercentage: v.taxPercentage ?? null,
            isActive: v.isActive ?? true,
            seoTitle: v.seoTitle || null,
            seoDescription: v.seoDescription || null,
            seoSlug: v.seoSlug || null,
            variantOptions: {
              create: (v.variantOptions || []).map((o) => ({
                name: o.name,
                value: o.value,
              })),
            },
            segmentPrices: {
              create: (v.segmentPrices || []).map((s) => ({
                customerType: s.customerType,
                regularPrice: s.regularPrice,
                salePrice: s.salePrice ?? null,
              })),
            },
          })),
        },
      },
      include: {
        variants: { include: { segmentPrices: true, variantOptions: true } },
        images: true,
        categories: true,
        tags: true,
      },
    });

    return res.json({ success: true, data: created });
  } catch (error) {
    console.error("POST /api/scripts/products error", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to create product" });
  }
});

module.exports = router;
