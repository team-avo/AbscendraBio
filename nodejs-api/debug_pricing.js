
const prisma = require("./prisma/client");
const { getPricingCustomerType } = require("./utils/pricingMapper");

async function debugPricing() {
    const B_ID = "cmi6aywno00nblp0icn21w0al"; // Barbara
    const D_ID = "cmjj1dcuf00damy0irdrfpmd1"; // David
    const VAR_ID = "cmfyyqhe3001hmr0jljccktq0"; // GLP-1 30mg

    console.log("--- Debugging Pricing Logic ---");

    // 1. Check Barbara
    const barbara = await prisma.customer.findUnique({
        where: { id: B_ID },
        select: { id: true, firstName: true, customerType: true },
    });
    console.log("Barbara:", barbara);

    if (barbara) {
        const bMapped = getPricingCustomerType(barbara.customerType);
        console.log("Barbara Mapped Type:", bMapped);

        const bVariant = await prisma.productVariant.findUnique({
            where: { id: VAR_ID },
            include: {
                segmentPrices: {
                    where: {
                        customerType: bMapped
                    }
                }
            }
        });
        console.log("Barbara Variant Lookup Result (SegmentPrices):", bVariant?.segmentPrices);
    }

    console.log("\n---");

    // 2. Check David
    const david = await prisma.customer.findUnique({
        where: { id: D_ID },
        select: { id: true, firstName: true, customerType: true },
    });
    console.log("David:", david);

    if (david) {
        const dMapped = getPricingCustomerType(david.customerType);
        console.log("David Mapped Type:", dMapped);

        const dVariant = await prisma.productVariant.findUnique({
            where: { id: VAR_ID },
            include: {
                segmentPrices: {
                    where: {
                        customerType: dMapped
                    }
                }
            }
        });
        console.log("David Variant Lookup Result (SegmentPrices):", dVariant?.segmentPrices);
    }

    // 3. Check All Segment Prices for Variant
    console.log("\n---");
    const allPrices = await prisma.segmentPrice.findMany({
        where: { variantId: VAR_ID }
    });
    console.log("All Segment Prices for Variant:", allPrices);

}

debugPricing()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
