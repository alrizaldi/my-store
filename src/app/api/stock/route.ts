import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const lowStock = searchParams.get("lowStock") === "true";
    const search = searchParams.get("search") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    const where: any = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(categoryId && { categoryId }),
    };

    if (lowStock) {
      // Find all active products to determine which ones have low stock
      const allProducts: Array<{
        id: string;
        stock: number;
        minStock: number | null;
      }> = await prisma.product.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          stock: true,
          minStock: true,
        },
      });
      
      // Filter products where stock <= minStock
      const lowStockProductIds = allProducts
        .filter((product: { id: string; stock: number; minStock: number | null }) => product.stock <= (product.minStock || 0))
        .map((product: { id: string; stock: number; minStock: number | null }) => product.id);
      
      where.id = { in: lowStockProductIds };
    }

    const [total, data] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          category: true,
        },
      }),
    ]);

    return Response.json({ data, total, page, limit });
  } catch (error) {
    console.error("[GET /api/stock]", error);
    return Response.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}