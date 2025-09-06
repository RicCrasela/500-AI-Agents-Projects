import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const room = url.searchParams.get("room") || "default";
  const role = (url.searchParams.get("role") || "viewer") as "host" | "viewer";
  const identity = url.searchParams.get("identity") || `${role}-${Math.random().toString(36).slice(2,8)}`;

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ error: "LiveKit env not set" }, { status: 500 });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
  });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish: role === "host",
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, url: livekitUrl });
}