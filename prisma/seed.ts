import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  console.log("🌱 Seeding database...");

  // Roles
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: {
      name: "Admin",
      permissions: [
        "orders:read", "orders:write",
        "products:read", "products:write",
        "employees:read", "employees:write",
        "stock:read", "stock:write",
        "purchasing:read", "purchasing:write",
        "reports:read", "settings:write",
        "cashier:use", "attendance:write",
      ],
    },
  });

  const cashierRole = await prisma.role.upsert({
    where: { name: "Cashier" },
    update: {},
    create: {
      name: "Cashier",
      permissions: ["orders:read", "orders:write", "products:read", "cashier:use"],
    },
  });

  await prisma.role.upsert({
    where: { name: "Manager" },
    update: {},
    create: {
      name: "Manager",
      permissions: [
        "orders:read", "orders:write",
        "products:read", "products:write",
        "stock:read", "stock:write",
        "purchasing:read", "purchasing:write",
        "reports:read", "employees:read",
        "cashier:use", "attendance:write",
      ],
    },
  });

  console.log("✅ Roles created");

  // Admin user
  const adminPassword = await bcrypt.hash("Admin1234!", 10);
  await prisma.user.upsert({
    where: { email: "admin@mystore.com" },
    update: {},
    create: {
      name: "Administrator",
      email: "admin@mystore.com",
      password: adminPassword,
      roleId: adminRole.id,
    },
  });

  // Cashier user
  const cashierPassword = await bcrypt.hash("Cashier1234!", 10);
  await prisma.user.upsert({
    where: { email: "cashier@mystore.com" },
    update: {},
    create: {
      name: "John Cashier",
      email: "cashier@mystore.com",
      password: cashierPassword,
      phone: "081234567890",
      roleId: cashierRole.id,
    },
  });

  console.log("✅ Users created");

  // Categories
  const categories = [
    { name: "Food & Beverages", description: "Makanan dan minuman" },
    { name: "Electronics", description: "Elektronik dan aksesori" },
    { name: "Clothing", description: "Pakaian dan aksesori fashion" },
    { name: "Household", description: "Peralatan rumah tangga" },
    { name: "Health & Beauty", description: "Kesehatan dan kecantikan" },
  ];

  const createdCategories: Record<string, string> = {};
  for (const cat of categories) {
    const c = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    createdCategories[cat.name] = c.id;
  }

  console.log("✅ Categories created");

  // Products
  const products = [
    { sku: "BEV-001", name: "Air Mineral 600ml", price: 3000, cost: 1500, stock: 100, minStock: 20, categoryId: createdCategories["Food & Beverages"] },
    { sku: "BEV-002", name: "Teh Botol 350ml", price: 5000, cost: 2500, stock: 80, minStock: 15, categoryId: createdCategories["Food & Beverages"] },
    { sku: "BEV-003", name: "Kopi Sachet", price: 2500, cost: 1200, stock: 200, minStock: 50, categoryId: createdCategories["Food & Beverages"] },
    { sku: "SNK-001", name: "Chitato 60g", price: 12000, cost: 8000, stock: 50, minStock: 10, categoryId: createdCategories["Food & Beverages"] },
    { sku: "SNK-002", name: "Oreo Original", price: 8000, cost: 5000, stock: 60, minStock: 10, categoryId: createdCategories["Food & Beverages"] },
    { sku: "ELC-001", name: "Baterai AA 4pcs", price: 15000, cost: 8000, stock: 30, minStock: 5, categoryId: createdCategories["Electronics"] },
    { sku: "ELC-002", name: "Kabel USB Type-C", price: 25000, cost: 12000, stock: 20, minStock: 5, categoryId: createdCategories["Electronics"] },
    { sku: "HLT-001", name: "Masker Medis 1box", price: 20000, cost: 12000, stock: 40, minStock: 10, categoryId: createdCategories["Health & Beauty"] },
    { sku: "HLT-002", name: "Hand Sanitizer 100ml", price: 18000, cost: 10000, stock: 35, minStock: 8, categoryId: createdCategories["Health & Beauty"] },
    { sku: "HSH-001", name: "Sabun Mandi Batang", price: 5000, cost: 2500, stock: 5, minStock: 10, categoryId: createdCategories["Household"] },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }

  console.log("✅ Products created");

  // Supplier
  await prisma.supplier.upsert({
    where: { id: "supplier-default" },
    update: {},
    create: {
      id: "supplier-default",
      name: "PT Sumber Jaya Abadi",
      phone: "021-55501234",
      email: "order@sumberjaya.com",
      address: "Jl. Industri Raya No. 45, Jakarta",
    },
  }).catch(() =>
    prisma.supplier.create({
      data: {
        name: "PT Sumber Jaya Abadi",
        phone: "021-55501234",
        email: "order@sumberjaya.com",
        address: "Jl. Industri Raya No. 45, Jakarta",
      },
    })
  );

  console.log("✅ Supplier created");

  // Sample promo
  await prisma.promo.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      name: "Welcome Discount 10%",
      description: "Diskon 10% untuk semua pembelian",
      code: "WELCOME10",
      type: "PERCENTAGE",
      value: 10,
      minOrder: 50000,
      maxDiscount: 20000,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2099-12-31"),
      isActive: true,
    },
  });

  console.log("✅ Promo created");
  console.log("\n🎉 Seeding complete!");
  console.log("\n📋 Default accounts:");
  console.log("   Admin:   admin@mystore.com    / Admin1234!");
  console.log("   Cashier: cashier@mystore.com  / Cashier1234!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
