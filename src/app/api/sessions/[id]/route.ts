import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Define types locally since Prisma v7+ doesn't export enums directly
type OrderStatus = "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
type PaymentMethod = "CASH" | "CARD" | "QRIS" | "TRANSFER" | "OTHER";

interface SessionOrder {
  id: string;
  orderNumber: string;
  total: number;
  status: OrderStatus;
  createdAt: Date;  // Changed from string to Date to match Prisma return type
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    status: PaymentStatus;
  }>;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await prisma.cashierSession.findUnique({
      where: { id },
      include: {
        cashier: {
          select: { id: true, name: true, email: true },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            createdAt: true,
            payments: {
              select: {
                method: true,
                amount: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    // Compute summary
    const completedOrders = session.orders.filter((o: SessionOrder) => o.status === "COMPLETED");
    const totalRevenue = completedOrders.reduce((sum, o: SessionOrder) => sum + o.total, 0);

    const allPayments = session.orders.flatMap((o: SessionOrder) => o.payments);
    const completedPayments = allPayments.filter((p) => p.status === "COMPLETED");

    const totalCash = completedPayments
      .filter((p) => p.method === "CASH")
      .reduce((sum, p) => sum + p.amount, 0);
    const totalCard = completedPayments
      .filter((p) => p.method === "CARD")
      .reduce((sum, p) => sum + p.amount, 0);
    const totalQris = completedPayments
      .filter((p) => p.method === "QRIS")
      .reduce((sum, p) => sum + p.amount, 0);

    // Strip payments from orders in response (internal computation only)
    const orders = session.orders.map(({ payments: _payments, ...order }) => order);

    return Response.json({
      ...session,
      orders,
      summary: {
        totalOrders: completedOrders.length,
        totalRevenue,
        totalCash,
        totalCard,
        totalQris,
      },
    });
  } catch (error) {
    console.error("[GET /api/sessions/[id]]", error);
    return Response.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { endCash, status } = body as {
      endCash?: number;
      status?: "OPEN" | "CLOSED";
    };

    if (status === "CLOSED" && (endCash === undefined || endCash === null)) {
      return Response.json(
        { error: "endCash is required when closing a session" },
        { status: 400 }
      );
    }

    const session = await prisma.cashierSession.update({
      where: { id },
      data: {
        ...(endCash !== undefined && { endCash }),
        ...(status !== undefined && { status }),
        ...(status === "CLOSED" && { closedAt: new Date() }),
      },
      include: {
        cashier: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return Response.json(session);
  } catch (error: unknown) {
    console.error("[PATCH /api/sessions/[id]]", error);
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code: string }).code;
      if (code === "P2025") {
        return Response.json({ error: "Session not found" }, { status: 404 });
      }
    }
    return Response.json({ error: "Failed to update session" }, { status: 500 });
  }
}