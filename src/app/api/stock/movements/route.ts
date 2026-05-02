import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Define type locally since Prisma types may not be directly exported
type StockMovementWhereInput = {
  productId?: string;
  type?: "IN" | "OUT" | "ADJUSTMENT" | "RETURN";
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const productId = searchParams.get("productId") ?? undefined;
    const type = searchParams.get("type") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    const where: StockMovementWhereInput = {
      ...(productId && { productId }),
      ...(type && { type: type as "IN" | "OUT" | "ADJUSTMENT" | "RETURN" }),
    };

    const [total, data] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      }),
    ]);

    return Response.json({ data, total, page, limit });
  } catch (error) {
    console.error("[GET /api/stock/movements]", error);
    return Response.json(
      { error: "Failed to fetch stock movements" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, type, quantity, notes } = body as {
      productId?: string;
      type?: string;
      quantity?: number;
      notes?: string;
    };

    if (!productId || !type || quantity === undefined || quantity === null) {
      return Response.json(
        { error: "productId, type, and quantity are required" },
        { status: 400 },
      );
    }

    const movementType = type as "IN" | "OUT" | "ADJUSTMENT" | "RETURN";

    // @ts-ignore - Prisma v7+ doesn't export enums, so we define types locally
    const movement = await prisma.$transaction(async (tx) => {
      // Fetch current product stock
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, stock: true },
      });

      if (!product) {
        throw Object.assign(new Error("Product not found"), {
          code: "NOT_FOUND",
        });
      }

      let newStock: number;

      if (movementType === "IN") {
        newStock = product.stock + quantity;
      } else if (movementType === "OUT") {
        if (product.stock < quantity) {
          throw Object.assign(
            new Error(`Insufficient stock. Available: ${product.stock}`),
            { code: "INSUFFICIENT_STOCK" },
          );
        }
        newStock = product.stock - quantity;
      } else if (movementType === "ADJUSTMENT") {
        // Set stock directly to the given quantity
        newStock = quantity;
      } else {
        // RETURN — treat like IN
        newStock = product.stock + quantity;
      }

      // Update product stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: newStock },
      });

      // Create stock movement record
      const created = await tx.stockMovement.create({
        data: {
          productId,
          type: movementType,
          quantity,
          notes,
        },
        include: {
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      });

      return created;
    });

    return Response.json(movement, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/stock/movements]", error);
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code: string }).code;
      if (code === "NOT_FOUND") {
        return Response.json({ error: "Product not found" }, { status: 404 });
      }
      if (code === "INSUFFICIENT_STOCK") {
        // Extract message from the error object safely
        const errorMessage =
          typeof error === "object" && "message" in error
            ? (error as { message: string }).message
            : "Insufficient stock";

        return Response.json({ error: errorMessage }, { status: 400 });
      }
    }
    return Response.json(
      { error: "Failed to create stock movement" },
      { status: 500 },
    );
  }
}
