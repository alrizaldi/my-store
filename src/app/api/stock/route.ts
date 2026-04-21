import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const lowStock = searchParams.get("lowStock") === "true";
    const search = searchParams.get("search") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(categoryId && { categoryId }),
    };

    if (lowStock) {
      // stock <= minStock — Prisma does not support column-to-column comparisons
      // directly in the typed client. We use a raw filter to get the ids first.
      const rows = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM products WHERE stock <= "minStock"`
      );
      const ids = rows.map((r) => r.id);
      where.id = { in: ids };
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
