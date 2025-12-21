import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/login"
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sessions/:path*",
    "/analytics/:path*",
    "/prs/:path*",
    "/plans/:path*",
    "/chat/:path*",
    "/settings/:path*",
    "/insights/:path*"
  ]
};
