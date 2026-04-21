import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const cashierId = searchParams.get("cashierId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    const where = {
      ...(cashierId && { cashierId }),
      ...(status && { status: status as "OPEN" | "CLOSED" }),
    };

    const [total, data] = await Promise.all([
      prisma.cashierSession.count({ where }),
      prisma.cashierSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { openedAt: "desc" },
        include: {
          cashier: {
            select: { id: true, name: true },
          },
          _count: {
            select: { orders: true },
          },
        },
      }),
    ]);

    return Response.json({ data, total, page, limit });
  } catch (error) {
    console.error("[GET /api/sessions]", error);
    return Response.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cashierId = request.headers.get("x-user-id");

    if (!cashierId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { startCash } = body as { startCash?: number };

    if (startCash === undefined || startCash === null) {
      return Response.json({ error: "startCash is required" }, { status: 400 });
    }

    // Check for existing open session
    const existingSession = await prisma.cashierSession.findFirst({
      where: { cashierId, status: "OPEN" },
    });

    if (existingSession) {
      return Response.json(
        { error: "You already have an open session" },
        { status: 400 }
      );
    }

    const session = await prisma.cashierSession.create({
      data: {
        cashierId,
        startCash,
        status: "OPEN",
      },
      include: {
        cashier: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return Response.json(session, { status: 201 });
  } catch (error) {
    console.error("[POST /api/sessions]", error);
    return Response.json({ error: "Failed to create session" }, { status: 500 });
  }
}
