import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");

    // Check if accessing admin route without admin role
    if (isAdminRoute && token?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/auth/login"
    },
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sessions/:path*",
    "/analytics/:path*",
    "/prs/:path*",
    "/plans/:path*",
    "/chat/:path*",
    "/sync/:path*",
    "/settings/:path*",
    "/insights/:path*",
    "/admin/:path*",
  ]
};
