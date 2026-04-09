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
    {
      email: "john.doe@example.com",
      password: "SecurePass123!",
      firstName: "John",
      lastName: "Doe",
      role: "CUSTOMER",
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
      isActive: true,
      isApproved: true,
      emailVerified: true,
      approvalStatus: "APPROVED",
    },
    {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@example.com",
      mobile: "+1234567891",
      customerType: "B2C",
      isActive: true,
      isApproved: true,
      emailVerified: true,
      approvalStatus: "APPROVED",
    },
    {
      firstName: "Acme",
      lastName: "Corporation",
      email: "contact@acme.com",
      mobile: "+1234567892",
      customerType: "B2B",
      isActive: true,
      isApproved: true,
      emailVerified: true,
      approvalStatus: "APPROVED",
    },
  ];

  for (const customerData of customers) {
    const existingUser = createdUsers.find(u => u.email === customerData.email);
    const customer = await prisma.customer.create({
      data: {
        ...customerData,
        user: existingUser ? { connect: { id: existingUser.id } } : undefined
      },
    });

    // If we linked a user, we should also update the user to link back (Prisma handles this via the relation but let's be explicitly sure if needed, though connect is enough)
    console.log(`✅ Created customer: ${customerData.email}`);
  }

  // Create sample products
  console.log("📦 Creating sample products...");
  const products = [
    {
      name: "BPC-157",
      description: "Body Protection Compound-157 is a pentadecapeptide that aids in tissue repair and recovery.",
      status: "ACTIVE",
      isPopular: true,
      images: ["/peptide-ab/PeptideVial_WhiteLabel_BPC15710_1024x1024.png"],
      variants: [
        {
          sku: "BPC-157-10MG",
          name: "10mg Vial",
          description: "10mg ultra-pure BPC-157 peptide",
          regularPrice: 49.99,
          salePrice: 44.99,
          weight: 0.05,
          segmentPrices: [
            { customerType: CustomerType.B2B, regularPrice: 39.99, salePrice: 34.99 },
            { customerType: CustomerType.ENTERPRISE_1, regularPrice: 34.99, salePrice: 29.99 },
          ],
        },
        {
          sku: "BPC-157-20MG",
          name: "20mg Vial",
          description: "20mg ultra-pure BPC-157 peptide",
          regularPrice: 89.99,
          salePrice: 79.99,
          weight: 0.05,
          segmentPrices: [
            { customerType: CustomerType.B2B, regularPrice: 69.99, salePrice: 64.99 },
            { customerType: CustomerType.ENTERPRISE_1, regularPrice: 59.99, salePrice: 54.99 },
          ],
        },
      ],
    },
    {
      name: "CJC-1295 (DAC)",
      description: "Growth hormone releasing hormone (GHRH) analog with Drug Affinity Complex for extended half-life.",
      status: "ACTIVE",
      isPopular: true,
      images: ["/peptide-ab/PeptideVial_WhiteLabel_CJC1295DAC10_1024x1024.png"],
      variants: [
        {
          sku: "CJC-1295-DAC-10MG",
          name: "10mg Vial",
          description: "10mg CJC-1295 with DAC",
          regularPrice: 75.00,
          salePrice: 65.00,
          weight: 0.05,
          segmentPrices: [
            { customerType: CustomerType.B2B, regularPrice: 55.00, salePrice: 50.00 },
          ],
        },
      ],
    },
    {
      name: "CJC-1295 + Ipamorelin",
      description: "A synergistic blend of CJC-1295 and Ipamorelin for optimal growth hormone optimization.",
      status: "ACTIVE",
      isPopular: true,
      images: ["/peptide-ab/PeptideVial_WhiteLabel_CJCIpa55_1024x1024.png"],
      variants: [
        {
          sku: "CJC-IPA-55MG",
          name: "5mg/5mg Blend",
          description: "5mg CJC-1295 + 5mg Ipamorelin",
          regularPrice: 110.00,
          salePrice: 95.00,
          weight: 0.05,
          segmentPrices: [
            { customerType: CustomerType.B2B, regularPrice: 85.00, salePrice: 75.00 },
          ],
        },
      ],
    },
    {
      name: "Cagrilintide",
      description: "A long-acting amylin analogue for weight management and metabolic health.",
      status: "ACTIVE",
      isPopular: true,
      images: ["/peptide-ab/PeptideVial_WhiteLabel_Cagrilintide10_1024x1024.png"],
      variants: [
        {
          sku: "CAGRI-10MG",
          name: "10mg Vial",
          description: "10mg research-grade Cagrilintide",
          regularPrice: 150.00,
          salePrice: 135.00,
          weight: 0.05,
          segmentPrices: [
            { customerType: CustomerType.B2B, regularPrice: 120.00, salePrice: 110.00 },
          ],
        },
      ],
    },
    {
      name: "AOD-9604",
      description: "Anti-Obesity Drug peptide fragment derived from Human Growth Hormone.",
      status: "ACTIVE",
      images: ["/peptide-ab/PeptideVial_WhiteLabel_AOD9645_1024x1024.png"],
      variants: [
        {
          sku: "AOD-9604-5MG",
          name: "5mg Vial",
          description: "5mg AOD-9604 peptide",
          regularPrice: 55.00,
          salePrice: 49.00,
          weight: 0.05,
          segmentPrices: [
            { customerType: CustomerType.B2B, regularPrice: 45.00, salePrice: 40.00 },
          ],
        },
      ],
    },
    {
      name: "Epithalon",
      description: "Synthetically derived peptide known for its anti-aging and telomere lengthening properties.",
      status: "ACTIVE",
      images: ["/peptide-ab/PeptideVial_WhiteLabel_Epithalon10_1024x1024.png"],
      variants: [
        {
          sku: "EPI-10MG",
          name: "10mg Vial",
          description: "10mg Epithalon (Epitalon)",
          regularPrice: 65.00,
          salePrice: 58.00,
          weight: 0.05,
          segmentPrices: [
            { customerType: CustomerType.B2B, regularPrice: 50.00, salePrice: 45.00 },
          ],
        },
      ],
    },
    {
      name: "Cerebrolysin",
      description: "A mixture of neuropeptides and free amino acids for neuroprotection and repair.",
      status: "ACTIVE",
      images: ["/peptide-ab/PeptideVial_WhiteLabel_Cerebroylsin30_1024x1024.png"],
      variants: [
        {
          sku: "CEREBRO-30ML",
          name: "30ml Solution",
          description: "30ml concentration of Cerebrolysin",
          regularPrice: 120.00,
          salePrice: 105.00,
          weight: 0.1,
          segmentPrices: [
            { customerType: CustomerType.B2B, regularPrice: 90.00, salePrice: 80.00 },
          ],
        },
      ],
    },
  ];

  for (const product of products) {
    const { variants, images, ...productData } = product;
    const createdProduct = await prisma.product.create({
      data: {
        ...productData,
        images: {
          create: (images || []).map(url => ({ url, altText: product.name }))
        },
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