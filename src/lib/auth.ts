import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const MYSTORE_JWT_SECRET = new TextEncoder().encode(
  process.env.MYSTORE_JWT_SECRET ?? "my-store-secret-key-change-in-production",
);

export interface JWTPayload {
  userId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(MYSTORE_JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, MYSTORE_JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
