import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

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
    const { id } = await params;
    const body = await request.json();
    const endCash = body.endCash as number | undefined;
    const status = body.status as "OPEN" | "CLOSED" | undefined;

    // Handle close session
    if (status === "CLOSED") {
      if (endCash === undefined || endCash === null) {
        return Response.json(
          { error: "endCash is required when closing a session" },
          { status: 400 }
        );
      }

      const session = await prisma.cashierSession.findUnique({
        where: { id },
        include: {
          orders: {
            where: { status: "COMPLETED" },
            select: {
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

      const allPayments = session.orders.flatMap((o) => o.payments);
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
      const actualCash = endCash!;
      const variance = actualCash - expectedCash;
      const totalRevenue = completedPayments.reduce((sum, p) => sum + p.amount, 0);

      const updatedSession = await prisma.cashierSession.update({
        where: { id },
        data: {
          endCash,
          status: "CLOSED",
          closedAt: new Date(),
        },
        include: {
          cashier: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return Response.json({
        ...updatedSession,
        closingStatement: {
          startCash: session.startCash,
          endCash: actualCash,
          expectedCash,
          variance,
          totalRevenue,
          payments: {
            cash: totalCash,
            card: totalCard,
            qris: totalQris,
            transfer: totalTransfer,
          },
        },
      });
    }

    // Handle other updates - can only be OPEN or undefined at this point
    const updateData: { endCash?: number; status?: "OPEN" } = {};
    if (endCash !== undefined) updateData.endCash = endCash;
    if (status !== undefined) updateData.status = "OPEN";

    const session = await prisma.cashierSession.update({
      where: { id },
      data: updateData,
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