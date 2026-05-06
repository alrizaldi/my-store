import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

type OrderStatus = "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
type PaymentMethod = "CASH" | "CARD" | "QRIS" | "TRANSFER" | "OTHER";

interface SessionOrder {
  id: string;
  orderNumber: string;
  total: number;
  status: OrderStatus;
  createdAt: Date;
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
    const totalTransfer = completedPayments
      .filter((p) => p.method === "TRANSFER")
      .reduce((sum, p) => sum + p.amount, 0);

    const expectedCash = session.startCash + totalCash;

    const orders = session.orders.map(({ payments: _payments, ...order }) => order);

    return Response.json({
      ...session,
      orders,
      summary: {
        totalOrders: completedOrders.length,
        totalRevenue,
        startCash: session.startCash,
        expectedCash,
        payments: {
          cash: totalCash,
          card: totalCard,
          qris: totalQris,
          transfer: totalTransfer,
        },
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
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify that the user trying to close the session is the one who opened it
    const session = await prisma.cashierSession.findUnique({
      where: { id },
    });

    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.cashierId !== userId) {
      return Response.json(
        { error: "You can only close sessions that you opened" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, endCash } = body as {
      status?: "OPEN" | "CLOSED";
      endCash?: number;
    };

    if (status === "CLOSED" && (endCash === undefined || endCash === null)) {
      return Response.json(
        { error: "endCash is required when closing a session" },
        { status: 400 }
      );
    }

    const updatedSession = await prisma.cashierSession.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(endCash !== undefined && { endCash }),
        ...(status === "CLOSED" && { closedAt: new Date() }),
      },
    });

    return Response.json(updatedSession);
  } catch (error) {
    console.error("[PATCH /api/sessions/[id]]", error);
    return Response.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.cashierSession.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/sessions/[id]]", error);
    return Response.json({ error: "Failed to delete session" }, { status: 500 });
  }
}