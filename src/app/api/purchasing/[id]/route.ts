import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Define types locally since Prisma v7+ doesn't export enums directly
type PurchaseStatus = "PENDING" | "RECEIVED" | "CANCELLED";
type StockMovementType = "IN" | "OUT";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
    });

    if (!purchaseOrder) {
      return Response.json(
        { error: "Purchase order not found" },
        { status: 404 },
      );
    }

    return Response.json(purchaseOrder);
  } catch (error) {
    console.error("[GET /api/purchasing/[id]]", error);
    return Response.json(
      { error: "Failed to fetch purchase order" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { status, notes, receivedAt } = body as {
      status?: PurchaseStatus;
      notes?: string;
      receivedAt?: string;
    };

    if (
      status !== undefined &&
      !Object.values({
        PENDING: "PENDING",
        RECEIVED: "RECEIVED",
        CANCELLED: "CANCELLED",
      }).includes(status)
    ) {
      return Response.json(
        { error: `status must be one of: PENDING, RECEIVED, CANCELLED` },
        { status: 400 },
      );
    }

    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!existingOrder) {
      return Response.json(
        { error: "Purchase order not found" },
        { status: 404 },
      );
    }

    if (status === "RECEIVED") {
      // Transaction: update status, increment stock, create StockMovement records
      // @ts-ignore - Prisma v7+ doesn't export enums, so we define types locally
      const updatedOrder = await prisma.$transaction(async (tx) => {
        const resolvedReceivedAt = receivedAt
          ? new Date(receivedAt)
          : new Date();

        // Increment stock for each item and create StockMovement
        for (const item of existingOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              type: "IN",
              quantity: item.quantity,
              notes: `Received from purchase order ${existingOrder.poNumber}`,
              productId: item.productId,
              referenceId: existingOrder.id,
            },
          });
        }

        return tx.purchaseOrder.update({
          where: { id },
          data: {
            status: "RECEIVED",
            receivedAt: resolvedReceivedAt,
            ...(notes !== undefined && { notes }),
          },
          include: {
            supplier: true,
            items: {
              include: {
                product: {
                  select: { id: true, name: true, sku: true },
                },
              },
            },
          },
        });
      });

      return Response.json(updatedOrder);
    }

    // Non-RECEIVED status update
    const updatedOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        ...(receivedAt !== undefined && { receivedAt: new Date(receivedAt) }),
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
    });

    return Response.json(updatedOrder);
  } catch (error: unknown) {
    console.error("[PATCH /api/purchasing/[id]]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return Response.json(
        { error: "Purchase order not found" },
        { status: 404 },
      );
    }
    return Response.json(
      { error: "Failed to update purchase order" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!purchaseOrder) {
      return Response.json(
        { error: "Purchase order not found" },
        { status: 404 },
      );
    }

    if (purchaseOrder.status !== "PENDING") {
      return Response.json(
        { error: "Only PENDING purchase orders can be deleted" },
        { status: 400 },
      );
    }

    // @ts-ignore - Prisma v7+ doesn't export enums, so we define types locally
    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrder.delete({ where: { id } });
    });

    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/purchasing/[id]]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return Response.json(
        { error: "Purchase order not found" },
        { status: 404 },
      );
    }
    return Response.json(
      { error: "Failed to delete purchase order" },
      { status: 500 },
    );
  }
}
