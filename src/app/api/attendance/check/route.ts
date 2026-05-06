import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      attendance: attendance || null
    });
  } catch (error) {
    console.error("[GET /api/attendance/check]", error);
    return Response.json({ error: "Failed to check attendance" }, { status: 500 });
  }
}