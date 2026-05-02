import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const orderId = searchParams.get("orderId") ?? undefined;
    const methodParam = searchParams.get("method") ?? undefined;
    const statusParam = searchParams.get("status") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    const method = methodParam as
      | "CASH"
      | "CARD"
      | "QRIS"
      | "TRANSFER"
      | "OTHER"
      | undefined;
    const status = statusParam as
      | "PENDING"
      | "COMPLETED"
      | "FAILED"
      | "REFUNDED"
      | undefined;

    const where: any = {
      ...(orderId ? { orderId } : {}),
      ...(method ? { method } : {}),
      ...(status ? { status } : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              cashier: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return Response.json({ data, total, page, limit });
  } catch (error) {
    console.error("[GET /api/payments]", error);
    return Response.json(
      { error: "Failed to fetch payments" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, method, amount, reference } = body as {
      orderId: string;
      method: "CASH" | "CARD" | "QRIS" | "TRANSFER" | "OTHER";
      amount: number;
      reference?: string;
    };

    if (!orderId || orderId.trim() === "") {
      return Response.json({ error: "orderId is required" }, { status: 400 });
    }
    if (!method) {
      return Response.json({ error: "method is required" }, { status: 400 });
    }
    if (
      !Object.values(["CASH", "CARD", "QRIS", "TRANSFER", "OTHER"]).includes(
        method,
      )
    ) {
      return Response.json(
        {
          error: `method must be one of: ${["CASH", "CARD", "QRIS", "TRANSFER", "OTHER"].join(", ")}`,
        },
        { status: 400 },
      );
    }
    if (amount === undefined || amount === null) {
      return Response.json({ error: "amount is required" }, { status: 400 });
    }
    if (Number(amount) <= 0) {
      return Response.json(
        { error: "amount must be greater than 0" },
        { status: 400 },
      );
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "COMPLETED") {
      return Response.json({ error: "Order already paid" }, { status: 400 });
    }

    const paidAmount = Number(amount);
    const change = Math.max(0, paidAmount - order.total);

    // @ts-ignore: Transaction client type cannot be imported in Prisma v7+
    const payment = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          orderId,
          method: method as any,
          amount: paidAmount,
          change,
          reference: reference ?? null,
          status: "COMPLETED" as const,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              cashier: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { status: "COMPLETED" as const },
      });

      return newPayment;
    });

    return Response.json(payment, { status: 201 });
  } catch (error) {
    console.error("[POST /api/payments]", error);
    return Response.json(
      { error: "Failed to create payment" },
      { status: 500 },
    );
  }
}
