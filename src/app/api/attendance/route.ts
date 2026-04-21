import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const userId = searchParams.get("userId") ?? undefined;
    const date = searchParams.get("date") ?? undefined;
    const month = searchParams.get("month") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    type WhereClause = {
      userId?: string;
      date?: Date | { gte: Date; lte: Date };
    };

    const where: WhereClause = {};

    if (userId) where.userId = userId;

    if (month) {
      // month format: YYYY-MM
      const [year, mon] = month.split("-").map(Number);
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 0, 23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    } else if (date) {
      where.date = new Date(date);
    }

    const [total, data] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    return Response.json({ data, total, page, limit });
  } catch (error) {
    console.error("[GET /api/attendance]", error);
    return Response.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, date, checkIn, checkOut, status, notes } = body as {
      userId?: string;
      date?: string;
      checkIn?: string;
      checkOut?: string;
      status?: string;
      notes?: string;
    };

    if (!userId || !date) {
      return Response.json({ error: "userId and date are required" }, { status: 400 });
    }

    const parsedDate = new Date(date);

    const record = await prisma.attendance.upsert({
      where: { userId_date: { userId, date: parsedDate } },
      create: {
        userId,
        date: parsedDate,
        checkIn: checkIn ? new Date(checkIn) : undefined,
        checkOut: checkOut ? new Date(checkOut) : undefined,
        status: (status as "PRESENT" | "ABSENT" | "LATE" | "LEAVE" | "HOLIDAY") ?? "PRESENT",
        notes,
      },
      update: {
        ...(checkIn !== undefined && { checkIn: new Date(checkIn) }),
        ...(checkOut !== undefined && { checkOut: new Date(checkOut) }),
        ...(status !== undefined && {
          status: status as "PRESENT" | "ABSENT" | "LATE" | "LEAVE" | "HOLIDAY",
        }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return Response.json(record, { status: 201 });
  } catch (error) {
    console.error("[POST /api/attendance]", error);
    return Response.json({ error: "Failed to upsert attendance" }, { status: 500 });
  }
}
