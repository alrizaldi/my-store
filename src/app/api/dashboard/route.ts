import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(_request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("auth-token");

    if (!tokenCookie?.value) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(tokenCookie.value);
    if (!payload) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Fetching dashboard data...");
    const now = new Date();

    // --- Today boundaries ---
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // --- Current month boundaries ---
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // --- Today: completed orders and revenue ---
    const [todayOrdersData, todayCustomers] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status: "COMPLETED",
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _count: { id: true },
        _sum: { total: true },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

    console.log("Today's data fetched:", { todayOrders: todayOrdersData._count.id, todayCustomers });

    // --- Month: completed orders and revenue ---
    const monthOrdersData = await prisma.order.aggregate({
      where: {
        status: "COMPLETED",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _count: { id: true },
      _sum: { total: true },
    });

    console.log("Month's data fetched:", { monthOrders: monthOrdersData._count.id });

    // --- Totals: products, employees, suppliers, lowStockProducts ---
    // Get all active products to calculate low stock in application code
    const allActiveProducts = await prisma.product.findMany({
      where: { 
        isActive: true 
      },
      select: {
        stock: true,
        minStock: true,
      },
    });
    
    const lowStockProducts = allActiveProducts.filter(
      product => product.stock <= (product.minStock || 0)
    ).length;

    console.log("Products data fetched:", { allActiveProducts: allActiveProducts.length, lowStockProducts });

    const [totalProducts, totalEmployees, totalSuppliers] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.supplier.count({ where: { isActive: true } }),
    ]);

    console.log("Totals fetched:", { totalProducts, totalEmployees, totalSuppliers });

    // --- Recent orders: last 5 with cashier name and total ---
    const recentOrders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        cashier: {
          select: { id: true, name: true },
        },
      },
    });

    console.log("Recent orders fetched:", recentOrders.length);

    // --- Top products: top 5 by quantity sold this month ---
    const topProductsRaw = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          status: "COMPLETED",
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      },
      _sum: {
        quantity: true,
        subtotal: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    });

    console.log("Top products raw fetched:", topProductsRaw.length);

    const topProductIds = topProductsRaw.map((item) => item.productId);
    const topProductDetails = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true },
    });

    console.log("Top product details fetched:", topProductDetails.length);

    const productMap = new Map(topProductDetails.map((p) => [p.id, p.name]));

    const topProducts = topProductsRaw.map((item) => ({
      productId: item.productId,
      name: productMap.get(item.productId) ?? "Unknown",
      totalSold: item._sum.quantity ?? 0,
      revenue: item._sum.subtotal ?? 0,
    }));

    console.log("Top products mapped:", topProducts.length);

    // --- Sales by day: last 7 days ---
    const last7Days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      last7Days.push(d);
    }

    const salesByDayResults = await Promise.all(
      last7Days.map(async (date) => {
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

        const agg = await prisma.order.aggregate({
          where: {
            status: "COMPLETED",
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          _count: { id: true },
          _sum: { total: true },
        });

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");

        return {
          date: `${yyyy}-${mm}-${dd}`,
          orders: agg._count.id ?? 0,
          revenue: agg._sum.total ?? 0,
        };
      })
    );

    console.log("Sales by day results:", salesByDayResults);

    const responseData = {
      today: {
        orders: todayOrdersData._count.id ?? 0,
        revenue: todayOrdersData._sum.total ?? 0,
        customers: todayCustomers,
      },
      month: {
        orders: monthOrdersData._count.id ?? 0,
        revenue: monthOrdersData._sum.total ?? 0,
      },
      totals: {
        products: totalProducts,
        employees: totalEmployees,
        suppliers: totalSuppliers,
        lowStockProducts,
      },
      recentOrders,
      topProducts,
      salesByDay: salesByDayResults,
    };

    console.log("Dashboard response prepared:", responseData);

    return Response.json(responseData);
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return Response.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}