import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const orderId = searchParams.get("orderId") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    const where = {
      ...(orderId && { orderId }),
    };

    const [total, data] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            include: {
              cashier: { select: { id: true, name: true } },
              session: { select: { id: true, startCash: true } },
            },
          },
        },
      }),
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
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, method, amount } = body as {
      orderId: string;
      method: "CASH" | "CARD" | "QRIS" | "TRANSFER" | "OTHER";
      amount: number;
    };

    if (!orderId || !method || amount === undefined) {
      return Response.json({ error: "orderId, method, and amount are required" }, { status: 400 });
    }

    // Get the order to verify it belongs to the user's session
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        session: true
      }
    });

    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if the order belongs to a session that the user owns
    if (order.sessionId && order.session && order.session.cashierId !== payload.userId) {
      return Response.json(
        { error: "You can only make payments for orders in your own session" },
        { status: 403 }
      );
    }

    // Check if the order belongs to the current user as cashier
    if (order.cashierId !== payload.userId) {
      return Response.json(
        { error: "You can only make payments for orders you created" },
        { status: 403 }
      );
    }

    // Verify the amount matches the order total if method is CASH
    if (method === "CASH" && amount < order.total) {
      return Response.json(
        { error: "Amount paid is less than the order total" },
        { status: 400 }
      );
    }

    // Create the payment
    const payment = await prisma.payment.create({
      data: {
        orderId,
        method,
        amount,
        status: "COMPLETED", // In a real app, this would be more dynamic
        reference: `PAY-${Date.now()}`, // Simple reference generation
      },
      include: {
        order: {
          include: {
            cashier: { select: { id: true, name: true } },
            session: { select: { id: true, startCash: true } },
          },
        },
      },
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
