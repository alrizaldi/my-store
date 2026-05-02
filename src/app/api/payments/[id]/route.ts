import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, name: true, sku: true },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    return Response.json(payment);
  } catch (error) {
    console.error("[GET /api/payments/[id]]", error);
    return Response.json({ error: "Failed to fetch payment" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { status } = body as {
      status?: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
    };

    if (!status) {
      return Response.json({ error: "status is required" }, { status: 400 });
    }

    if (status !== "REFUNDED") {
      return Response.json(
        { error: "Only REFUNDED status is allowed via PATCH" },
        { status: 400 },
      );
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!existingPayment) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    if (existingPayment.status === "REFUNDED") {
      return Response.json(
        { error: "Payment is already refunded" },
        { status: 400 },
      );
    }

    // @ts-ignore: Transaction client type cannot be imported in Prisma v7+
    const updatedPayment = await prisma.$transaction(async (tx) => {
      // Restore stock for each order item and create RETURN StockMovement records
      for (const item of existingPayment.order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            type: "RETURN" as const,
            quantity: item.quantity,
            notes: `Refund for order ${existingPayment.order.orderNumber}`,
            productId: item.productId,
            referenceId: existingPayment.orderId,
          },
        });
      }

      // Update order status to REFUNDED
      await tx.order.update({
        where: { id: existingPayment.orderId },
        data: { status: "REFUNDED" as const },
      });

      // Update payment status to REFUNDED
      return tx.payment.update({
        where: { id },
        data: { status: "REFUNDED" as const },
        include: {
          order: {
            include: {
              items: {
                include: {
                  product: {
                    select: { id: true, name: true, sku: true },
                  },
                },
              },
            },
          },
        },
      });
    });

    return Response.json(updatedPayment);
  } catch (error: unknown) {
    console.error("[PATCH /api/payments/[id]]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }
    return Response.json(
      { error: "Failed to update payment" },
      { status: 500 },
    );
  }
}
