import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];

    if (!token) {
      console.error("[GET /api/attendance/check] No token provided");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      console.error("[GET /api/attendance/check] Invalid token");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = payload.userId;

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if the user has marked attendance today
    const attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Return whether attendance was marked today
    return Response.json({
      hasMarkedAttendance: !!attendance,
      attendance: attendance || null,
    });
  } catch (error) {
    console.error("[GET /api/attendance/check]", error);
    return Response.json(
      { error: "Failed to check attendance" },
      { status: 500 },
    );
  }
}
