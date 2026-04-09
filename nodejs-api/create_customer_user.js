const prisma = require('./prisma/client');
const bcrypt = require('bcryptjs');

async function createCustomerLogin() {
  try {
    const email = "john.doe@example.com";
    const password = "SecurePass123!";

    // Find the customer
    const customer = await prisma.customer.findUnique({
      where: { email }
    });

    if (!customer) {
      console.log("Customer not found.");
      return;
    }

    // Set customer to approved and email verified so login isn't blocked
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        isApproved: true,
        emailVerified: true
      }
    });

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log("User already exists for this email.");
    } else {
      const hashedPassword = await bcrypt.hash(password, 12);
      
      await prisma.user.create({
        data: {
          email: email,
          password: hashedPassword,
          firstName: customer.firstName,
          lastName: customer.lastName,
          role: "CUSTOMER", // Using 'CUSTOMER' as the default role for these
          isActive: true,
          customerId: customer.id,
        }
      });
      console.log(`✅ Successfully created login for ${email} with password ${password}`);
    }

  } catch (error) {
    console.error("Error creating customer login:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createCustomerLogin();
