import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("auth-token");
    return Response.json({ success: true });
  } catch (error) {
    console.error("[POST /api/auth/logout]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
