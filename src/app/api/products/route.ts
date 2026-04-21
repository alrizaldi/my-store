import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const showAll = searchParams.get("showAll") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    const where = {
      ...(showAll ? {} : { isActive: true }),
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { sku: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return Response.json({ data, total, page, limit });
  } catch (error) {
    console.error("[GET /api/products]", error);
    return Response.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sku, name, description, price, cost, stock, minStock, imageUrl, categoryId } =
      body as {
        sku: string;
        name: string;
        description?: string;
        price: number;
        cost?: number;
        stock?: number;
        minStock?: number;
        imageUrl?: string;
        categoryId?: string;
      };

    if (!name || !sku || price === undefined || price === null) {
      return Response.json(
        { error: "name, sku, and price are required" },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        description,
        price: Number(price),
        cost: cost !== undefined ? Number(cost) : 0,
        stock: stock !== undefined ? Number(stock) : 0,
        minStock: minStock !== undefined ? Number(minStock) : 5,
        imageUrl,
        categoryId: categoryId ?? null,
      },
      include: { category: true },
    });

    return Response.json(product, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/products]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return Response.json({ error: "SKU already exists" }, { status: 409 });
    }
    return Response.json({ error: "Failed to create product" }, { status: 500 });
  }
}
