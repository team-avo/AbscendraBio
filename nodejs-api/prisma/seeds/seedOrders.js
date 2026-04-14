const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedOrders() {
  console.log('🛒 Seeding fake orders...');

  // Fetch existing data
  const customers = await prisma.customer.findMany();
  const variants = await prisma.productVariant.findMany({ include: { product: true } });

  if (!customers.length || !variants.length) {
    console.error('❌ No customers or variants found. Run main seed first.');
    process.exit(1);
  }

  const statuses = ['PENDING', 'PROCESSING', 'LABEL_CREATED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'ON_HOLD'];

  const addresses = [
    { firstName: 'John', lastName: 'Doe', address1: '123 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US', phone: '555-0101' },
    { firstName: 'Jane', lastName: 'Smith', address1: '456 Oak Ave', city: 'Los Angeles', state: 'CA', postalCode: '90001', country: 'US', phone: '555-0202' },
    { firstName: 'Acme', lastName: 'Corp', address1: '789 Business Blvd', city: 'Chicago', state: 'IL', postalCode: '60601', country: 'US', phone: '555-0303' },
    { firstName: 'Robert', lastName: 'Johnson', address1: '321 Elm St', city: 'Houston', state: 'TX', postalCode: '77001', country: 'US', phone: '555-0404' },
    { firstName: 'Sarah', lastName: 'Williams', address1: '654 Pine Rd', city: 'Phoenix', state: 'AZ', postalCode: '85001', country: 'US', phone: '555-0505' },
  ];

  // Delete existing orders first
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();

  const orderData = [
    { statusIdx: 4, custIdx: 0, items: [{ varIdx: 0, qty: 2 }, { varIdx: 2, qty: 1 }], daysAgo: 45 },  // DELIVERED
    { statusIdx: 4, custIdx: 1, items: [{ varIdx: 1, qty: 1 }], daysAgo: 38 },                          // DELIVERED
    { statusIdx: 3, custIdx: 2, items: [{ varIdx: 3, qty: 3 }, { varIdx: 4, qty: 1 }], daysAgo: 22 },  // SHIPPED
    { statusIdx: 3, custIdx: 0, items: [{ varIdx: 5, qty: 2 }], daysAgo: 18 },                          // SHIPPED
    { statusIdx: 2, custIdx: 1, items: [{ varIdx: 6, qty: 1 }, { varIdx: 0, qty: 2 }], daysAgo: 12 },  // LABEL_CREATED
    { statusIdx: 2, custIdx: 2, items: [{ varIdx: 2, qty: 4 }], daysAgo: 10 },                          // LABEL_CREATED
    { statusIdx: 1, custIdx: 0, items: [{ varIdx: 1, qty: 1 }, { varIdx: 3, qty: 1 }], daysAgo: 7 },   // PROCESSING
    { statusIdx: 1, custIdx: 1, items: [{ varIdx: 4, qty: 2 }], daysAgo: 6 },                           // PROCESSING
    { statusIdx: 1, custIdx: 2, items: [{ varIdx: 5, qty: 1 }, { varIdx: 6, qty: 1 }], daysAgo: 5 },   // PROCESSING
    { statusIdx: 0, custIdx: 0, items: [{ varIdx: 0, qty: 3 }], daysAgo: 3 },                           // PENDING
    { statusIdx: 0, custIdx: 1, items: [{ varIdx: 2, qty: 1 }, { varIdx: 4, qty: 2 }], daysAgo: 2 },   // PENDING
    { statusIdx: 0, custIdx: 2, items: [{ varIdx: 1, qty: 1 }], daysAgo: 1 },                           // PENDING
    { statusIdx: 6, custIdx: 0, items: [{ varIdx: 3, qty: 2 }], daysAgo: 30 },                          // ON_HOLD
    { statusIdx: 5, custIdx: 1, items: [{ varIdx: 5, qty: 1 }], daysAgo: 25 },                          // CANCELLED
    { statusIdx: 4, custIdx: 2, items: [{ varIdx: 6, qty: 2 }, { varIdx: 0, qty: 1 }], daysAgo: 60 },  // DELIVERED
    { statusIdx: 3, custIdx: 0, items: [{ varIdx: 4, qty: 1 }, { varIdx: 2, qty: 3 }], daysAgo: 15 },  // SHIPPED
    { statusIdx: 1, custIdx: 2, items: [{ varIdx: 1, qty: 2 }], daysAgo: 4 },                           // PROCESSING
    { statusIdx: 0, custIdx: 1, items: [{ varIdx: 6, qty: 1 }, { varIdx: 3, qty: 1 }], daysAgo: 0 },   // PENDING (today)
  ];

  let created = 0;
  for (let i = 0; i < orderData.length; i++) {
    const od = orderData[i];
    const customer = customers[od.custIdx % customers.length];
    const addr = addresses[od.custIdx % addresses.length];
    const status = statuses[od.statusIdx];

    // Calculate totals
    let subtotal = 0;
    const itemsPayload = od.items.map(({ varIdx, qty }) => {
      const variant = variants[varIdx % variants.length];
      const price = parseFloat(variant.salePrice || variant.regularPrice);
      subtotal += price * qty;
      return { variantId: variant.id, quantity: qty, unitPrice: price, totalPrice: price * qty };
    });

    const shipping = 15.00;
    const tax = parseFloat((subtotal * 0.08).toFixed(2));
    const total = subtotal + shipping + tax;

    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - od.daysAgo);

    const orderNum = `ORD-${String(10000 + i + 1).padStart(5, '0')}`;

    await prisma.order.create({
      data: {
        orderNumber: orderNum,
        customerId: customer.id,
        status,
        subtotal,
        shippingAmount: shipping,
        taxAmount: tax,
        totalAmount: total,
        selectedPaymentType: "AUTHORIZE_NET",
        // Shipping address
        shippingFirstName: addr.firstName,
        shippingLastName: addr.lastName,
        shippingAddress1: addr.address1,
        shippingCity: addr.city,
        shippingState: addr.state,
        shippingPostalCode: addr.postalCode,
        shippingCountry: addr.country,
        shippingPhone: addr.phone,
        // Billing same as shipping
        billingFirstName: addr.firstName,
        billingLastName: addr.lastName,
        billingAddress1: addr.address1,
        billingCity: addr.city,
        billingState: addr.state,
        billingPostalCode: addr.postalCode,
        billingCountry: addr.country,
        billingPhone: addr.phone,
        createdAt,
        updatedAt: createdAt,
        items: { create: itemsPayload },
      },
    });

    console.log(`✅ #${orderNum} | ${status.padEnd(13)} | $${total.toFixed(2).padStart(8)} | ${customer.email}`);
    created++;
  }

  const totalRevenue = await prisma.order.aggregate({
    _sum: { totalAmount: true },
    where: { status: { notIn: ['CANCELLED'] } },
  });

  console.log(`\n🎉 Seeded ${created} orders!`);
  console.log(`💰 Total revenue (excl. cancelled): $${parseFloat(totalRevenue._sum.totalAmount || 0).toFixed(2)}`);
  await prisma.$disconnect();
}

seedOrders().catch(e => { console.error(e); process.exit(1); });
