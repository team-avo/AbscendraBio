const prisma = require('./client');
const { CustomerType } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clean up existing data
  console.log("🧹 Cleaning up existing data...");
  await prisma.auditLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.segmentPrice.deleteMany();
  await prisma.variantOption.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.address.deleteMany();
  await prisma.location.deleteMany();
  await prisma.shippingZone.deleteMany();
  await prisma.setting.deleteMany();

  // Create default users
  console.log("👥 Creating default users...");

  const users = [
    {
      email: "admin@example.com",
      password: "SecurePass123!",
      firstName: "Admin",
      lastName: "User",
      role: "ADMIN",
    },
    {
      email: "manager@example.com",
      password: "SecurePass123!",
      firstName: "Manager",
      lastName: "User",
      role: "MANAGER",
    },
    {
      email: "staff@example.com",
      password: "SecurePass123!",
      firstName: "Staff",
      lastName: "User",
      role: "STAFF",
    },
  ];

  const createdUsers = [];

  for (const userData of users) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        isActive: true,
      },
    });

    createdUsers.push(user);
    console.log(
      `✅ Created ${userData.role.toLowerCase()} user: ${userData.email}`
    );
  }

  // Create user permissions for admin
  console.log("🔐 Creating user permissions...");
  const adminUser = createdUsers.find((u) => u.role === "ADMIN");

  if (adminUser) {
    const modules = [
      "users",
      "customers",
      "products",
      "orders",
      "payments",
      "shipping",
      "analytics",
      "settings",
    ];
    const actions = ["CREATE", "READ", "UPDATE", "DELETE"];

    for (const module of modules) {
      for (const action of actions) {
        await prisma.userPermission.create({
          data: {
            userId: adminUser.id,
            module,
            action,
            granted: true,
          },
        });
      }
    }
    console.log("✅ Created admin permissions");
  }

  // Create manager permissions
  const managerUser = createdUsers.find((u) => u.role === "MANAGER");
  if (managerUser) {
    const managerModules = [
      "customers",
      "products",
      "orders",
      "payments",
      "shipping",
      "analytics",
    ];
    const managerActions = ["CREATE", "READ", "UPDATE"];

    for (const module of managerModules) {
      for (const action of managerActions) {
        await prisma.userPermission.create({
          data: {
            userId: managerUser.id,
            module,
            action,
            granted: true,
          },
        });
      }
    }
    console.log("✅ Created manager permissions");
  }

  // Create staff permissions
  const staffUser = createdUsers.find((u) => u.role === "STAFF");
  if (staffUser) {
    const staffModules = ["customers", "products", "orders"];
    const staffActions = ["READ", "UPDATE"];

    for (const module of staffModules) {
      for (const action of staffActions) {
        await prisma.userPermission.create({
          data: {
            userId: staffUser.id,
            module,
            action,
            granted: true,
          },
        });
      }
    }
    console.log("✅ Created staff permissions");
  }

  // Create sample customers
  console.log("👤 Creating sample customers...");
  const customers = [
    {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      mobile: "+1234567890",
      customerType: "B2C",
    },
    {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@example.com",
      mobile: "+1234567891",
      customerType: "B2C",
    },
    {
      firstName: "Acme",
      lastName: "Corporation",
      email: "contact@acme.com",
      mobile: "+1234567892",
      customerType: "B2B",
    },
  ];

  for (const customerData of customers) {
    const customer = await prisma.customer.create({
      data: customerData,
    });
    console.log(`✅ Created customer: ${customerData.email}`);
  }

  // Create sample products
  console.log("📦 Creating sample products...");
  const products = [
    {
      name: "Peptide Complex A",
      description: "Advanced peptide complex for muscle recovery and growth",
      status: "ACTIVE",
      variants: [
        {
          sku: "PEP-A-30ML",
          name: "30ml Bottle",
          description: "30ml peptide complex solution",
          regularPrice: 89.99,
          salePrice: 79.99,
          weight: 0.1,
          segmentPrices: [
            {
              customerType: CustomerType.B2B,
              regularPrice: 79.99,
              salePrice: 69.99,
            },
            {
              customerType: CustomerType.ENTERPRISE_1,
              regularPrice: 69.99,
              salePrice: 59.99,
            },
          ],
        },
        {
          sku: "PEP-A-50ML",
          name: "50ml Bottle",
          description: "50ml peptide complex solution",
          regularPrice: 129.99,
          salePrice: 119.99,
          weight: 0.15,
          segmentPrices: [
            {
              customerType: CustomerType.B2B,
              regularPrice: 119.99,
              salePrice: 109.99,
            },
            {
              customerType: CustomerType.ENTERPRISE_1,
              regularPrice: 109.99,
              salePrice: 99.99,
            },
          ],
        },
      ],
    },
    {
      name: "Peptide Complex B",
      description: "Specialized peptide complex for joint health",
      status: "ACTIVE",
      variants: [
        {
          sku: "PEP-B-30ML",
          name: "30ml Bottle",
          description: "30ml peptide complex solution",
          regularPrice: 99.99,
          salePrice: 89.99,
          weight: 0.1,
          segmentPrices: [
            {
              customerType: CustomerType.B2B,
              regularPrice: 89.99,
              salePrice: 79.99,
            },
            {
              customerType: CustomerType.ENTERPRISE_1,
              regularPrice: 79.99,
              salePrice: 69.99,
            },
          ],
        },
      ],
    },
    {
      name: "Collagen Peptide Blend",
      description: "Premium collagen peptides for skin and joint health",
      status: "ACTIVE",
      variants: [
        {
          sku: "COL-B-50G",
          name: "50g Powder",
          description: "50g collagen peptide powder",
          regularPrice: 45.99,
          salePrice: 39.99,
          weight: 0.05,
          segmentPrices: [
            {
              customerType: CustomerType.B2B,
              regularPrice: 39.99,
              salePrice: 34.99,
            },
            {
              customerType: CustomerType.ENTERPRISE_1,
              regularPrice: 34.99,
              salePrice: 29.99,
            },
          ],
        },
      ],
    },
    {
      name: "Recovery Peptide Stack",
      description: "Complete recovery peptide stack for athletes",
      status: "ACTIVE",
      variants: [
        {
          sku: "REC-S-30DAY",
          name: "30-Day Supply",
          description: "30-day supply of recovery peptides",
          regularPrice: 199.99,
          salePrice: 179.99,
          weight: 0.3,
          segmentPrices: [
            {
              customerType: CustomerType.B2B,
              regularPrice: 179.99,
              salePrice: 159.99,
            },
            {
              customerType: CustomerType.ENTERPRISE_1,
              regularPrice: 159.99,
              salePrice: 139.99,
            },
          ],
        },
      ],
    },
  ];

  for (const product of products) {
    const { variants, ...productData } = product;
    const createdProduct = await prisma.product.create({
      data: {
        ...productData,
        variants: {
          create: variants.map((variant) => {
            const { segmentPrices, ...variantData } = variant;
            return {
              ...variantData,
              segmentPrices: {
                create: segmentPrices,
              },
            };
          }),
        },
      },
    });
    console.log(`Created product: ${createdProduct.name}`);
  }

  // Create default warehouse location
  console.log("🏢 Creating default warehouse location...");
  const defaultLocation = await prisma.location.create({
    data: {
      name: "Main Warehouse",
      address: "123 Warehouse St, Warehouse City, WH 12345, US",
      isActive: true,
    },
  });
  console.log(`✅ Created location: ${defaultLocation.name}`);

  // Create inventory for all variants
  console.log("📦 Creating inventory records...");
  const allVariants = await prisma.productVariant.findMany({
    include: {
      product: {
        select: {
          name: true,
        },
      },
    },
  });

  for (const variant of allVariants) {
    await prisma.inventory.create({
      data: {
        variantId: variant.id,
        locationId: defaultLocation.id,
        quantity: 100, // Default stock quantity
        reservedQty: 0,
        lowStockAlert: 10,
      },
    });
    console.log(
      `✅ Created inventory for ${variant.product.name} - ${variant.name} (SKU: ${variant.sku})`
    );
  }

  // Create system settings
  console.log("⚙️ Creating system settings...");
  const settings = [
    {
      key: "site_name",
      value: "Peptides Store",
      type: "string",
      category: "general",
    },
    {
      key: "site_description",
      value: "Premium peptide supplements for health and performance",
      type: "string",
      category: "general",
    },
    {
      key: "contact_email",
      value: "support@peptides.com",
      type: "string",
      category: "contact",
    },
    {
      key: "contact_phone",
      value: "+1-555-0123",
      type: "string",
      category: "contact",
    },
    { key: "currency", value: "USD", type: "string", category: "payment" },
    { key: "tax_rate", value: "8.5", type: "decimal", category: "payment" },
    {
      key: "free_shipping_threshold",
      value: "100.00",
      type: "decimal",
      category: "shipping",
    },
    {
      key: "default_shipping_rate",
      value: "9.99",
      type: "decimal",
      category: "shipping",
    },
  ];

  for (const setting of settings) {
    await prisma.setting.create({
      data: setting,
    });
  }
  console.log("✅ Created system settings");

  // Create shipping zones
  console.log("🚚 Creating shipping zones...");
  const shippingZones = [
    {
      name: "United States",
      countries: ["US"],
      rates: [
        { name: "Standard Shipping", rate: 9.99, freeShippingThreshold: 100.0 },
        { name: "Express Shipping", rate: 19.99, freeShippingThreshold: 150.0 },
      ],
    },
    {
      name: "Canada",
      countries: ["CA"],
      rates: [
        {
          name: "Standard Shipping",
          rate: 14.99,
          freeShippingThreshold: 150.0,
        },
        { name: "Express Shipping", rate: 29.99, freeShippingThreshold: 200.0 },
      ],
    },
  ];

  for (const zoneData of shippingZones) {
    const { rates, ...zoneInfo } = zoneData;

    const zone = await prisma.shippingZone.create({
      data: {
        ...zoneInfo,
        rates: {
          create: rates,
        },
      },
    });

    console.log(`✅ Created shipping zone: ${zone.name}`);
  }

  console.log("");
  console.log("🎉 Database seeding completed successfully!");
  console.log("");
  console.log("📋 Default Users Created:");
  console.log("   Admin: admin@example.com / SecurePass123!");
  console.log("   Manager: manager@example.com / SecurePass123!");
  console.log("   Staff: staff@example.com / SecurePass123!");
  console.log("");
  console.log("📊 Sample Data Created:");
  console.log("   - 3 customers");
  console.log("   - 3 products with variants");
  console.log("   - 1 warehouse location");
  console.log("   - Inventory records for all variants (100 units each)");
  console.log("   - System settings");
  console.log("   - Shipping zones and rates");
  console.log("   - User permissions");
  console.log("");
  console.log(
    "🚀 You can now start the application and login with the default users!"
  );
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });