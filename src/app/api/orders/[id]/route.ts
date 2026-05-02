import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
        },
        payments: true,
        cashier: { select: { id: true, name: true, email: true } },
        session: true,
        promo: true,
      },
    });

    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    return Response.json(order);
  } catch (error) {
    console.error("[GET /api/orders/[id]]", error);
    return Response.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, notes } = body as {
      status?: "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
      notes?: string;
    };

    // Fetch current order to check if status change to CANCELLED requires stock restore
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!existingOrder) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    let order;

    // If status is being changed to CANCELLED, restore stock
    if (status === "CANCELLED" && existingOrder.status !== "CANCELLED") {
      order = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updatedOrder = await tx.order.update({
            where: { id },
            data: {
              status,
              ...(notes !== undefined && { notes }),
            },
            include: {
              items: {
                include: { product: true },
              },
              payments: true,
              cashier: { select: { id: true, name: true, email: true } },
              session: true,
              promo: true,
            },
          });

          // Restore stock for each order item
          for (const item of existingOrder.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });

            await tx.stockMovement.create({
              data: {
                type: "RETURN",
                quantity: item.quantity,
                notes: `Cancelled - Order ${existingOrder.orderNumber}`,
                productId: item.productId,
                referenceId: id,
              },
            });
          }

          return updatedOrder;
        },
      );
    } else {
      // Normal update (no stock restoration needed)
      order = await prisma.order.update({
        where: { id },
        data: {
          ...(status !== undefined && { status }),
          ...(notes !== undefined && { notes }),
        },
        include: {
          items: {
            include: { product: true },
          },
          payments: true,
          cashier: { select: { id: true, name: true, email: true } },
          session: true,
          promo: true,
        },
      });
    }

    return Response.json(order);
  } catch (error: unknown) {
    console.error("[PATCH /api/orders/[id]]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }
    return Response.json({ error: "Failed to update order" }, { status: 500 });
  }
}

export async function DELETE() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
