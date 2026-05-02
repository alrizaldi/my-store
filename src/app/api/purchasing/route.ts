import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Define type locally since Prisma v7+ doesn't export enums directly
type PurchaseStatus = "PENDING" | "RECEIVED" | "CANCELLED";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const supplierId = searchParams.get("supplierId") ?? undefined;
    const statusParam = searchParams.get("status") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    const status = statusParam as PurchaseStatus | undefined;

    const where = {
      ...(supplierId ? { supplierId } : {}),
      ...(status ? { status } : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, name: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return Response.json({ data, total, page, limit });
  } catch (error) {
    console.error("[GET /api/purchasing]", error);
    return Response.json({ error: "Failed to fetch purchase orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierId, items, tax, notes } = body as {
      supplierId: string;
      items: Array<{ productId: string; quantity: number; unitCost: number }>;
      tax?: number;
      notes?: string;
    };

    if (!supplierId || supplierId.trim() === "") {
      return Response.json({ error: "supplierId is required" }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json(
        { error: "items must be a non-empty array" },
        { status: 400 }
      );
    }

    for (const item of items) {
      if (!item.productId || item.quantity == null || item.unitCost == null) {
        return Response.json(
          { error: "Each item must have productId, quantity, and unitCost" },
          { status: 400 }
        );
      }
      if (item.quantity <= 0) {
        return Response.json(
          { error: "Item quantity must be greater than 0" },
          { status: 400 }
        );
      }
      if (item.unitCost < 0) {
        return Response.json(
          { error: "Item unitCost must be 0 or greater" },
          { status: 400 }
        );
      }
    }

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return Response.json({ error: "Supplier not found" }, { status: 404 });
    }

    const poNumber = `PO-${Date.now()}`;
    const taxAmount = tax !== undefined ? Number(tax) : 0;

    const itemsWithSubtotals = items.map((item) => ({
      ...item,
      subtotal: item.quantity * item.unitCost,
    }));

    const subtotal = itemsWithSubtotals.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal + taxAmount;

    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId,
          subtotal,
          tax: taxAmount,
          total,
          notes: notes ?? null,
          items: {
            create: itemsWithSubtotals.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          supplier: {
            select: { id: true, name: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
      });

      return createdOrder;
    });

    return Response.json(purchaseOrder, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/purchasing]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return Response.json(
        { error: "Purchase order with this PO number already exists" },
        { status: 409 }
      );
    }
    return Response.json({ error: "Failed to create purchase order" }, { status: 500 });
  }
}