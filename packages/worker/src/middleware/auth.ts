import { Context, Next } from "hono";
import { SignJWT, jwtVerify } from "jose";

interface JWTPayload {
  user_id: string;
  name: string;
}

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = header.slice(7);
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    c.set("user", payload as unknown as JWTPayload);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
}

export async function createToken(payload: JWTPayload, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(key);
}
