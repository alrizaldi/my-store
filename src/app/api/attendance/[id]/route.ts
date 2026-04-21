import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const record = await prisma.attendance.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!record) {
      return Response.json({ error: "Attendance record not found" }, { status: 404 });
    }

    return Response.json(record);
  } catch (error) {
    console.error("[GET /api/attendance/[id]]", error);
    return Response.json({ error: "Failed to fetch attendance record" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { checkIn, checkOut, status, notes } = body as {
      checkIn?: string;
      checkOut?: string;
      status?: string;
      notes?: string;
    };

    const record = await prisma.attendance.update({
      where: { id },
      data: {
        ...(checkIn !== undefined && { checkIn: new Date(checkIn) }),
        ...(checkOut !== undefined && { checkOut: new Date(checkOut) }),
        ...(status !== undefined && {
          status: status as "PRESENT" | "ABSENT" | "LATE" | "LEAVE" | "HOLIDAY",
        }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return Response.json(record);
  } catch (error: unknown) {
    console.error("[PATCH /api/attendance/[id]]", error);
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code: string }).code;
      if (code === "P2025") {
        return Response.json({ error: "Attendance record not found" }, { status: 404 });
      }
    }
    return Response.json({ error: "Failed to update attendance record" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.attendance.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/attendance/[id]]", error);
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code: string }).code;
      if (code === "P2025") {
        return Response.json({ error: "Attendance record not found" }, { status: 404 });
      }
    }
    return Response.json({ error: "Failed to delete attendance record" }, { status: 500 });
  }
}
