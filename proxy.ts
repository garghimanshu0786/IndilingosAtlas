import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/quest")) {
    return NextResponse.next();
  }
  const res = NextResponse.next();
  res.headers.set("Permissions-Policy", "microphone=*, xr-spatial-tracking=*, gamepad=*");
  return res;
}

export const config = {
  matcher: ["/quest", "/quest/:path*"],
};
