const ExcelJS = require("exceljs");
const prisma = require("../prisma/client");
const logger = require("../utils/logger");
const { queueProductSync } = require("../integrations/skydell_odoo");

/**
 * Export all products with comprehensive data to Excel
 * Generates multiple sheets: Products, Variants, Segment Prices, Categories, Tags, Images, Inventory
 */
async function exportProductsToExcel() {
  // Fetch all products with all related data
  const products = await prisma.product.findMany({
    include: {
      variants: {
        include: {
          segmentPrices: true,
          variantOptions: true,
          images: {
            orderBy: { sortOrder: "asc" },
          },
          inventory: {
            include: {
              location: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
      },
      categories: true,
      tags: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Centre Labs";
  workbook.created = new Date();

  // ============================================
  // SHEET 1: Products
  // ============================================
  const productsSheet = workbook.addWorksheet("Products");
  productsSheet.columns = [
    { header: "Product ID", key: "id", width: 25 },
    { header: "Product Name", key: "name", width: 30 },
    { header: "Description", key: "description", width: 50 },
    { header: "Status", key: "status", width: 12 },
    { header: "ShipStation SKU", key: "shipstationSku", width: 20 },
    { header: "Display Order", key: "displayOrder", width: 15 },
    { header: "Is Popular", key: "isPopular", width: 12 },
    { header: "SEO Title", key: "seoTitle", width: 30 },
    { header: "SEO Description", key: "seoDescription", width: 50 },
    { header: "SEO Slug", key: "seoSlug", width: 30 },
    { header: "Created At", key: "createdAt", width: 20 },
    { header: "Updated At", key: "updatedAt", width: 20 },
  ];

  // Style header row
  productsSheet.getRow(1).font = { bold: true };
  productsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  productsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Add product data
  products.forEach((product) => {
    productsSheet.addRow({
      id: product.id,
      name: product.name,
      description: product.description || "",
      status: product.status,
      shipstationSku: product.shipstationSku || "",
      displayOrder: product.displayOrder,
      isPopular: product.isPopular ? "Yes" : "No",
      seoTitle: product.seoTitle || "",
      seoDescription: product.seoDescription || "",
      seoSlug: product.seoSlug || "",
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });
  });

  // ============================================
  // SHEET 2: Variants
  // ============================================
  const variantsSheet = workbook.addWorksheet("Variants");
  variantsSheet.columns = [
    { header: "Variant ID", key: "id", width: 25 },
    { header: "Product ID", key: "productId", width: 25 },
    { header: "Product Name", key: "productName", width: 30 },
    { header: "Variant SKU", key: "sku", width: 20 },
    { header: "ShipStation SKU", key: "shipstationSku", width: 20 },
    { header: "Variant Name", key: "name", width: 30 },
    { header: "Description", key: "description", width: 50 },
    { header: "Regular Price", key: "regularPrice", width: 15 },
    { header: "Sale Price", key: "salePrice", width: 15 },
    { header: "Weight (oz)", key: "weight", width: 12 },
    { header: "HSN Code", key: "hsn", width: 15 },
    { header: "Ideal For", key: "idealFor", width: 30 },
    { header: "Key Benefits", key: "keyBenefits", width: 40 },
    { header: "Tax Name", key: "taxName", width: 20 },
    { header: "Tax Percentage", key: "taxPercentage", width: 15 },
    { header: "Is Active", key: "isActive", width: 12 },
    { header: "SEO Title", key: "seoTitle", width: 30 },
    { header: "SEO Description", key: "seoDescription", width: 50 },
    { header: "SEO Slug", key: "seoSlug", width: 30 },
    { header: "Created At", key: "createdAt", width: 20 },
    { header: "Updated At", key: "updatedAt", width: 20 },
  ];

  // Style header
  variantsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  variantsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF70AD47" },
  };

  // Add variant data
  products.forEach((product) => {
    product.variants.forEach((variant) => {
      variantsSheet.addRow({
        id: variant.id,
        productId: product.id,
        productName: product.name,
        sku: variant.sku,
        shipstationSku: variant.shipstationSku || "",
        name: variant.name,
        description: variant.description || "",
        regularPrice: Number(variant.regularPrice),
        salePrice: variant.salePrice ? Number(variant.salePrice) : "",
        weight: variant.weight ? Number(variant.weight) : "",
        hsn: variant.hsn || "",
        idealFor: variant.idealFor || "",
        keyBenefits: variant.keyBenefits || "",
        taxName: variant.taxName || "",
        taxPercentage: variant.taxPercentage
          ? Number(variant.taxPercentage)
          : "",
        isActive: variant.isActive ? "Yes" : "No",
        seoTitle: variant.seoTitle || "",
        seoDescription: variant.seoDescription || "",
        seoSlug: variant.seoSlug || "",
        createdAt: variant.createdAt,
        updatedAt: variant.updatedAt,
      });
    });
  });

  // Format price columns
  variantsSheet.getColumn("regularPrice").numFmt = "$#,##0.00";
  variantsSheet.getColumn("salePrice").numFmt = "$#,##0.00";
  variantsSheet.getColumn("taxPercentage").numFmt = '0.00"%"';

  // ============================================
  // SHEET 3: Segment Prices
  // ============================================
  const segmentPricesSheet = workbook.addWorksheet("Segment Prices");
  segmentPricesSheet.columns = [
    { header: "Segment Price ID", key: "id", width: 25 },
    { header: "Variant ID", key: "variantId", width: 25 },
    { header: "Variant SKU", key: "variantSku", width: 20 },
    { header: "Variant Name", key: "variantName", width: 30 },
    { header: "Product ID", key: "productId", width: 25 },
    { header: "Product Name", key: "productName", width: 30 },
    { header: "Customer Type", key: "customerType", width: 15 },
    { header: "Regular Price", key: "regularPrice", width: 15 },
    { header: "Sale Price", key: "salePrice", width: 15 },
    { header: "Created At", key: "createdAt", width: 20 },
    { header: "Updated At", key: "updatedAt", width: 20 },
  ];

  // Style header
  segmentPricesSheet.getRow(1).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  segmentPricesSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFC000" },
  };

  // Add segment price data
  products.forEach((product) => {
    product.variants.forEach((variant) => {
      variant.segmentPrices.forEach((segmentPrice) => {
        segmentPricesSheet.addRow({
          id: segmentPrice.id,
          variantId: variant.id,
          variantSku: variant.sku,
          variantName: variant.name,
          productId: product.id,
          productName: product.name,
          customerType: segmentPrice.customerType,
          regularPrice: Number(segmentPrice.regularPrice),
          salePrice: segmentPrice.salePrice
            ? Number(segmentPrice.salePrice)
            : "",
          createdAt: segmentPrice.createdAt,
          updatedAt: segmentPrice.updatedAt,
        });
      });
    });
  });

  // Format price columns
  segmentPricesSheet.getColumn("regularPrice").numFmt = "$#,##0.00";
  segmentPricesSheet.getColumn("salePrice").numFmt = "$#,##0.00";

  // ============================================
  // SHEET 4: Categories
  // ============================================
  const categoriesSheet = workbook.addWorksheet("Categories");
  categoriesSheet.columns = [
    { header: "Category ID", key: "id", width: 25 },
    { header: "Product ID", key: "productId", width: 25 },
    { header: "Product Name", key: "productName", width: 30 },
    { header: "Category Name", key: "name", width: 30 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];

  // Style header
  categoriesSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  categoriesSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF5B9BD5" },
  };

  // Add category data
  products.forEach((product) => {
    product.categories.forEach((category) => {
      categoriesSheet.addRow({
        id: category.id,
        productId: product.id,
        productName: product.name,
        name: category.name,
        createdAt: category.createdAt,
      });
    });
  });

  // ============================================
  // SHEET 5: Tags
  // ============================================
  const tagsSheet = workbook.addWorksheet("Tags");
  tagsSheet.columns = [
    { header: "Tag ID", key: "id", width: 25 },
    { header: "Product ID", key: "productId", width: 25 },
    { header: "Product Name", key: "productName", width: 30 },
    { header: "Tag", key: "tag", width: 30 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];

  // Style header
  tagsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  tagsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF9E480E" },
  };

  // Add tag data
  products.forEach((product) => {
    product.tags.forEach((tag) => {
      tagsSheet.addRow({
        id: tag.id,
        productId: product.id,
        productName: product.name,
        tag: tag.tag,
        createdAt: tag.createdAt,
      });
    });
  });

  // ============================================
  // SHEET 6: Product Images
  // ============================================
  const productImagesSheet = workbook.addWorksheet("Product Images");
  productImagesSheet.columns = [
    { header: "Image ID", key: "id", width: 25 },
    { header: "Product ID", key: "productId", width: 25 },
    { header: "Product Name", key: "productName", width: 30 },
    { header: "Image URL", key: "url", width: 60 },
    { header: "Alt Text", key: "altText", width: 40 },
    { header: "Sort Order", key: "sortOrder", width: 12 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];

  // Style header
  productImagesSheet.getRow(1).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  productImagesSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC55A11" },
  };

  // Add product image data
  products.forEach((product) => {
    product.images.forEach((image) => {
      productImagesSheet.addRow({
        id: image.id,
        productId: product.id,
        productName: product.name,
        url: image.url,
        altText: image.altText || "",
        sortOrder: image.sortOrder,
        createdAt: image.createdAt,
      });
    });
  });

  // ============================================
  // SHEET 7: Variant Images
  // ============================================
  const variantImagesSheet = workbook.addWorksheet("Variant Images");
  variantImagesSheet.columns = [
    { header: "Image ID", key: "id", width: 25 },
    { header: "Variant ID", key: "variantId", width: 25 },
    { header: "Variant SKU", key: "variantSku", width: 20 },
    { header: "Variant Name", key: "variantName", width: 30 },
    { header: "Product ID", key: "productId", width: 25 },
    { header: "Product Name", key: "productName", width: 30 },
    { header: "Image URL", key: "url", width: 60 },
    { header: "Alt Text", key: "altText", width: 40 },
    { header: "Sort Order", key: "sortOrder", width: 12 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];

  // Style header
  variantImagesSheet.getRow(1).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  variantImagesSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };

  // Add variant image data
  products.forEach((product) => {
    product.variants.forEach((variant) => {
      variant.images.forEach((image) => {
        variantImagesSheet.addRow({
          id: image.id,
          variantId: variant.id,
          variantSku: variant.sku,
          variantName: variant.name,
          productId: product.id,
          productName: product.name,
          url: image.url,
          altText: image.altText || "",
          sortOrder: image.sortOrder,
          createdAt: image.createdAt,
        });
      });
    });
  });

  // ============================================
  // SHEET 8: Variant Options
  // ============================================
  const variantOptionsSheet = workbook.addWorksheet("Variant Options");
  variantOptionsSheet.columns = [
    { header: "Option ID", key: "id", width: 25 },
    { header: "Variant ID", key: "variantId", width: 25 },
    { header: "Variant SKU", key: "variantSku", width: 20 },
    { header: "Variant Name", key: "variantName", width: 30 },
    { header: "Product ID", key: "productId", width: 25 },
    { header: "Product Name", key: "productName", width: 30 },
    { header: "Option Name", key: "name", width: 20 },
    { header: "Option Value", key: "value", width: 20 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];

  // Style header
  variantOptionsSheet.getRow(1).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  variantOptionsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF44546A" },
  };

  // Add variant option data
  products.forEach((product) => {
    product.variants.forEach((variant) => {
      variant.variantOptions.forEach((option) => {
        variantOptionsSheet.addRow({
          id: option.id,
          variantId: variant.id,
          variantSku: variant.sku,
          variantName: variant.name,
          productId: product.id,
          productName: product.name,
          name: option.name,
          value: option.value,
          createdAt: option.createdAt,
        });
      });
    });
  });

  // ============================================
  // SHEET 9: Inventory
  // ============================================
  const inventorySheet = workbook.addWorksheet("Inventory");
  inventorySheet.columns = [
    { header: "Inventory ID", key: "id", width: 25 },
    { header: "Variant ID", key: "variantId", width: 25 },
    { header: "Variant SKU", key: "variantSku", width: 20 },
    { header: "Variant Name", key: "variantName", width: 30 },
    { header: "Product ID", key: "productId", width: 25 },
    { header: "Product Name", key: "productName", width: 30 },
    { header: "Location ID", key: "locationId", width: 25 },
    { header: "Location Name", key: "locationName", width: 30 },
    { header: "Quantity", key: "quantity", width: 12 },
    { header: "Reserved Qty", key: "reservedQty", width: 12 },
    { header: "Available", key: "available", width: 12 },
    { header: "Low Stock Alert", key: "lowStockAlert", width: 15 },
  ];

  // Style header
  inventorySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  inventorySheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF264478" },
  };

  // Add inventory data
  products.forEach((product) => {
    product.variants.forEach((variant) => {
      variant.inventory.forEach((inv) => {
        const available = inv.quantity - (inv.reservedQty || 0);
        inventorySheet.addRow({
          id: inv.id,
          variantId: variant.id,
          variantSku: variant.sku,
          variantName: variant.name,
          productId: product.id,
          productName: product.name,
          locationId: inv.locationId,
          locationName: inv.location?.name || "Unknown",
          quantity: inv.quantity,
          reservedQty: inv.reservedQty || 0,
          available: available,
          lowStockAlert: inv.lowStockAlert || 0,
        });
      });
    });
  });

  // Return the workbook buffer
  return await workbook.xlsx.writeBuffer();
}

/**
 * Update products from Excel file
 * @param {Buffer} fileBuffer - The Excel file buffer
 * @returns {Promise<{success: boolean, stats: any, errors: any[]}>}
 */
async function updateProductsFromExcel(fileBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const stats = {
    productsUpdated: 0,
    variantsUpdated: 0,
    segmentPricesUpdated: 0,
    inventoryUpdated: 0,
    productImagesUpdated: 0,
    variantImagesUpdated: 0,
    othersUpdated: 0,
  };
  const errors = [];

  // Helper to map headers to column indices
  const getHeaderMap = (sheet) => {
    const map = {};
    const headerRow = sheet.getRow(1);
    logger.debug(`Processing sheet: ${sheet.name}`);

    headerRow.eachCell((cell, colNumber) => {
      // Handle rich text headers or simple values
      let header = cell.value;
      if (header && typeof header === "object") {
        header = header.richText
          ? header.richText.map((t) => t.text).join("")
          : header.result || "";
      }
      header = String(header || "")
        .trim()
        .toLowerCase();

      logger.debug(`Found header at col ${colNumber}: "${header}"`);

      // Map headers to internal keys (case-insensitive)
      if (
        header === "product id" ||
        header === "variant id" ||
        header === "segment price id" ||
        header === "category id" ||
        header === "tag id" ||
        header === "image id" ||
        header === "option id" ||
        header === "inventory id"
      )
        map["id"] = colNumber;
      else if (
        header === "product name" ||
        header === "variant name" ||
        header === "category name" ||
        header === "option name" ||
        header === "location name"
      )
        map["name"] = colNumber;
      else if (header === "description") map["description"] = colNumber;
      else if (header === "status") map["status"] = colNumber;
      else if (header === "shipstation sku") map["shipstationSku"] = colNumber;
      else if (header === "display order") map["displayOrder"] = colNumber;
      else if (header === "is popular") map["isPopular"] = colNumber;
      else if (header === "seo title") map["seoTitle"] = colNumber;
      else if (header === "seo description") map["seoDescription"] = colNumber;
      else if (header === "seo slug") map["seoSlug"] = colNumber;
      else if (header === "variant sku") map["sku"] = colNumber;
      else if (header === "regular price") map["regularPrice"] = colNumber;
      else if (header === "sale price") map["salePrice"] = colNumber;
      else if (header === "weight (oz)") map["weight"] = colNumber;
      else if (header === "hsn code") map["hsn"] = colNumber;
      else if (header === "ideal for") map["idealFor"] = colNumber;
      else if (header === "key benefits") map["keyBenefits"] = colNumber;
      else if (header === "tax name") map["taxName"] = colNumber;
      else if (header === "tax percentage") map["taxPercentage"] = colNumber;
      else if (header === "is active") map["isActive"] = colNumber;
      else if (header === "customer type") map["customerType"] = colNumber;
      else if (header === "tag") map["tag"] = colNumber;
      else if (header === "image url") map["url"] = colNumber;
      else if (header === "alt text") map["altText"] = colNumber;
      else if (header === "sort order") map["sortOrder"] = colNumber;
      else if (header === "option value") map["value"] = colNumber;
      else if (header === "location id") map["locationId"] = colNumber;
      else if (header === "quantity") map["quantity"] = colNumber;
      else if (header === "reserved qty") map["reservedQty"] = colNumber;
      else if (header === "low stock alert") map["lowStockAlert"] = colNumber;
    });
    logger.debug("Header Map", { map });
    return map;
  };

  // Helper to get cell value safely using map
  const getVal = (row, map, key) => {
    const colIndex = map[key];
    if (!colIndex) return undefined;
    const cell = row.getCell(colIndex);
    let val = cell.value;

    // Handle rich text or formula results
    if (val && typeof val === "object") {
      if (val.richText) val = val.richText.map((t) => t.text).join("");
      else if (val.result !== undefined) val = val.result;
      else if (val.text) val = val.text;
    }

    // Handle hyperlinks (ExcelJS returns object with text and hyperlink)
    if (val && typeof val === "object" && val.text && val.hyperlink) {
      val = val.text;
    }

    return val;
  };

  // 1. Update Products
  const productsSheet = workbook.getWorksheet("Products");
  if (productsSheet) {
    const map = getHeaderMap(productsSheet);
    const rowCount = productsSheet.rowCount;
    logger.info(`Products Sheet: Row count is ${rowCount}`);

    for (let i = 2; i <= rowCount; i++) {
      const row = productsSheet.getRow(i);
      if (!row.hasValues) continue;

      try {
        const id = getVal(row, map, "id");
        if (!id) {
          logger.debug(`Row ${i}: No ID found, skipping`);
          continue;
        }

        const data = {
          name: getVal(row, map, "name"),
          description: getVal(row, map, "description"),
          status: getVal(row, map, "status"),
          shipstationSku: getVal(row, map, "shipstationSku"),
          displayOrder: parseInt(getVal(row, map, "displayOrder") || 0),
          isPopular: getVal(row, map, "isPopular") === "Yes",
        };

        logger.info(`Updating Product ${id}`, { data });

        await prisma.product.update({
          where: { id },
          data: {
            name: data.name,
            description: data.description || null,
            status: data.status,
            shipstationSku: data.shipstationSku || null,
            displayOrder: data.displayOrder,
            isPopular: data.isPopular,
          },
        });
        stats.productsUpdated++;
        logger.info(`Product ${id} updated successfully`);
      } catch (err) {
        logger.error(`Error updating product row ${i}`, err);
        errors.push(`Product ID ${getVal(row, map, "id")}: ${err.message}`);
      }
    }
  }

  // 2. Update Variants
  const variantsSheet = workbook.getWorksheet("Variants");
  if (variantsSheet) {
    const map = getHeaderMap(variantsSheet);
    const rowCount = variantsSheet.rowCount;
    logger.info(`Variants Sheet: Row count is ${rowCount}`);

    for (let i = 2; i <= rowCount; i++) {
      const row = variantsSheet.getRow(i);
      if (!row.hasValues) continue;

      try {
        const id = getVal(row, map, "id");
        if (!id) continue;

        const updateData = {
          sku: getVal(row, map, "sku"),
          shipstationSku: getVal(row, map, "shipstationSku") || null,
          name: getVal(row, map, "name"),
          description: getVal(row, map, "description") || null,
          regularPrice: parseFloat(getVal(row, map, "regularPrice") || 0),
          salePrice: getVal(row, map, "salePrice")
            ? parseFloat(getVal(row, map, "salePrice"))
            : null,
          weight: getVal(row, map, "weight")
            ? parseFloat(getVal(row, map, "weight"))
            : null,
          hsn: getVal(row, map, "hsn") || null,
          idealFor: getVal(row, map, "idealFor") || null,
          keyBenefits: getVal(row, map, "keyBenefits") || null,
          taxName: getVal(row, map, "taxName") || null,
          taxPercentage: getVal(row, map, "taxPercentage")
            ? parseFloat(getVal(row, map, "taxPercentage"))
            : null,
          isActive: getVal(row, map, "isActive") === "Yes",
          seoTitle: getVal(row, map, "seoTitle") || null,
          seoDescription: getVal(row, map, "seoDescription") || null,
          seoSlug: getVal(row, map, "seoSlug") || null,
        };

        logger.info(`Updating Variant ${id}`, { updateData });

        try {
          // Try updating by ID first
          await prisma.productVariant.update({
            where: { id },
            data: updateData,
          });
          stats.variantsUpdated++;
        } catch (err) {
          // If ID update fails (e.g. record not found), try updating by SKU
          if (err.code === "P2025" && updateData.sku) {
            logger.debug(
              `Variant ID ${id} not found, trying fallback to SKU: ${updateData.sku}`,
            );
            try {
              await prisma.productVariant.update({
                where: { sku: updateData.sku },
                data: updateData,
              });
              stats.variantsUpdated++;
              logger.debug(`Variant updated by SKU ${updateData.sku}`);
              continue; // Success!
            } catch (skuErr) {
              logger.error(
                `Failed to update variant by SKU ${updateData.sku}`,
                skuErr,
              );
              throw skuErr; // Throw original or new error to be caught by outer catch
            }
          } else {
            throw err;
          }
        }
      } catch (err) {
        logger.error(`Error updating variant row ${i}`, err);
        errors.push(
          `Variant ID ${getVal(row, map, "id")} (SKU: ${getVal(row, map, "sku")}): ${err.message}`,
        );
      }
    }
  }

  // 3. Update Segment Prices
  const segmentPricesSheet = workbook.getWorksheet("Segment Prices");
  if (segmentPricesSheet) {
    const map = getHeaderMap(segmentPricesSheet);
    const rowCount = segmentPricesSheet.rowCount;
    for (let i = 2; i <= rowCount; i++) {
      const row = segmentPricesSheet.getRow(i);
      if (!row.hasValues) continue;
      try {
        const sku = getVal(row, map, "sku");
        const customerType = getVal(row, map, "customerType");

        if (!sku || !customerType) continue;

        // Find variant by SKU to get the correct variantId
        const variant = await prisma.productVariant.findUnique({
          where: { sku },
        });

        if (!variant) {
          errors.push(
            `Segment Price row ${i}: Variant not found for SKU ${sku}`,
          );
          continue;
        }

        // Update using the composite unique key [variantId, customerType]
        await prisma.segmentPrice.updateMany({
          where: {
            variantId: variant.id,
            customerType: customerType,
          },
          data: {
            regularPrice: parseFloat(getVal(row, map, "regularPrice") || 0),
            salePrice: getVal(row, map, "salePrice")
              ? parseFloat(getVal(row, map, "salePrice"))
              : null,
          },
        });
        stats.segmentPricesUpdated++;
      } catch (err) {
        errors.push(`Segment Price row ${i}: ${err.message}`);
      }
    }
  }

  // 4. Update Inventory
  const inventorySheet = workbook.getWorksheet("Inventory");
  const inventoryAffectedProductIds = new Set();
  if (inventorySheet) {
    const map = getHeaderMap(inventorySheet);
    const rowCount = inventorySheet.rowCount;
    for (let i = 2; i <= rowCount; i++) {
      const row = inventorySheet.getRow(i);
      if (!row.hasValues) continue;
      try {
        const sku = getVal(row, map, "sku");
        const locationName = getVal(row, map, "name"); // Location name

        if (!sku || !locationName) continue;

        // Find variant by SKU
        const variant = await prisma.productVariant.findUnique({
          where: { sku },
        });

        if (!variant) {
          errors.push(`Inventory row ${i}: Variant not found for SKU ${sku}`);
          continue;
        }

        // Find location by name
        const location = await prisma.location.findUnique({
          where: { name: locationName },
        });

        if (!location) {
          errors.push(
            `Inventory row ${i}: Location not found: ${locationName}`,
          );
          continue;
        }

        // Update using the composite unique key [variantId, locationId]
        await prisma.inventory.updateMany({
          where: {
            variantId: variant.id,
            locationId: location.id,
          },
          data: {
            quantity: parseInt(getVal(row, map, "quantity") || 0),
            reservedQty: parseInt(getVal(row, map, "reservedQty") || 0),
            lowStockAlert: parseInt(getVal(row, map, "lowStockAlert") || 0),
          },
        });
        stats.inventoryUpdated++;
        if (variant.productId)
          inventoryAffectedProductIds.add(variant.productId);
      } catch (err) {
        errors.push(`Inventory row ${i}: ${err.message}`);
      }
    }
  }

  // Queue Odoo sync for products affected by Excel inventory import
  try {
    for (const productId of inventoryAffectedProductIds) {
      queueProductSync(
        productId,
        "INVENTORY_UPDATE",
        "Excel import inventory update",
      ).catch((err) =>
        logger.error("[ODOO SYNC] Failed to queue after Excel import", {
          error: err.message,
        }),
      );
    }
  } catch (syncErr) {
    logger.error("[ODOO SYNC] Error queuing sync after Excel import", {
      error: syncErr.message,
    });
  }

  // 5. Update Categories (Names only)
  const categoriesSheet = workbook.getWorksheet("Categories");
  if (categoriesSheet) {
    const map = getHeaderMap(categoriesSheet);
    const rowCount = categoriesSheet.rowCount;
    for (let i = 2; i <= rowCount; i++) {
      const row = categoriesSheet.getRow(i);
      if (!row.hasValues) continue;
      try {
        const id = getVal(row, map, "id");
        if (!id) continue;
        await prisma.productCategory.update({
          where: { id },
          data: { name: getVal(row, map, "name") },
        });
        stats.othersUpdated++;
      } catch (err) {
        errors.push(`Category ID ${getVal(row, map, "id")}: ${err.message}`);
      }
    }
  }

  // 6. Update Tags
  const tagsSheet = workbook.getWorksheet("Tags");
  if (tagsSheet) {
    const map = getHeaderMap(tagsSheet);
    const rowCount = tagsSheet.rowCount;
    for (let i = 2; i <= rowCount; i++) {
      const row = tagsSheet.getRow(i);
      if (!row.hasValues) continue;
      try {
        const id = getVal(row, map, "id");
        if (!id) continue;
        await prisma.productTag.update({
          where: { id },
          data: { tag: getVal(row, map, "tag") },
        });
        stats.othersUpdated++;
      } catch (err) {
        errors.push(`Tag ID ${getVal(row, map, "id")}: ${err.message}`);
      }
    }
  }

  // 7. Update Product Images
  const productImagesSheet = workbook.getWorksheet("Product Images");
  if (productImagesSheet) {
    const map = getHeaderMap(productImagesSheet);
    const rowCount = productImagesSheet.rowCount;
    for (let i = 2; i <= rowCount; i++) {
      const row = productImagesSheet.getRow(i);
      if (!row.hasValues) continue;
      try {
        const productId = getVal(row, map, "id"); // This is product ID from the sheet
        const url = getVal(row, map, "url");

        if (!productId || !url) continue;

        // Update image by productId and url (most reliable combination)
        const updateResult = await prisma.productImage.updateMany({
          where: {
            productId: productId,
            url: url,
          },
          data: {
            altText: getVal(row, map, "altText") || null,
            sortOrder: parseInt(getVal(row, map, "sortOrder") || 0),
          },
        });

        if (updateResult.count > 0) {
          stats.productImagesUpdated++;
        }
      } catch (err) {
        errors.push(`Product Image row ${i}: ${err.message}`);
      }
    }
  }

  // 8. Update Variant Images
  const variantImagesSheet = workbook.getWorksheet("Variant Images");
  if (variantImagesSheet) {
    const map = getHeaderMap(variantImagesSheet);
    const rowCount = variantImagesSheet.rowCount;
    for (let i = 2; i <= rowCount; i++) {
      const row = variantImagesSheet.getRow(i);
      if (!row.hasValues) continue;
      try {
        const sku = getVal(row, map, "sku");
        const url = getVal(row, map, "url");

        if (!sku || !url) continue;

        // Find variant by SKU
        const variant = await prisma.productVariant.findUnique({
          where: { sku },
        });

        if (!variant) {
          errors.push(
            `Variant Image row ${i}: Variant not found for SKU ${sku}`,
          );
          continue;
        }

        // Update image by variantId and url
        const updateResult = await prisma.variantImage.updateMany({
          where: {
            variantId: variant.id,
            url: url,
          },
          data: {
            altText: getVal(row, map, "altText") || null,
            sortOrder: parseInt(getVal(row, map, "sortOrder") || 0),
          },
        });

        if (updateResult.count > 0) {
          stats.variantImagesUpdated++;
        }
      } catch (err) {
        errors.push(`Variant Image row ${i}: ${err.message}`);
      }
    }
  }

  // 9. Update Variant Options
  const variantOptionsSheet = workbook.getWorksheet("Variant Options");
  if (variantOptionsSheet) {
    const map = getHeaderMap(variantOptionsSheet);
    const rowCount = variantOptionsSheet.rowCount;
    for (let i = 2; i <= rowCount; i++) {
      const row = variantOptionsSheet.getRow(i);
      if (!row.hasValues) continue;
      try {
        const id = getVal(row, map, "id");
        if (!id) continue;
        await prisma.variantOption.update({
          where: { id },
          data: {
            name: getVal(row, map, "name"),
            value: getVal(row, map, "value"),
          },
        });
        stats.othersUpdated++;
      } catch (err) {
        errors.push(
          `Variant Option ID ${getVal(row, map, "id")}: ${err.message}`,
        );
      }
    }
  }

  return { success: true, stats, errors };
}

module.exports = {
  exportProductsToExcel,
  updateProductsFromExcel,
};
