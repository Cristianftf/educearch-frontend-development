import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/apple-icon.png",
  "/placeholder.svg",
  "/placeholder-logo.svg",
  "/placeholder-logo.png",
  "/placeholder-user.jpg",
  "/placeholder.jpg",
  "/icon.svg",
  "/icon-dark-32x32.png",
  "/icon-light-32x32.png",
];

// Rutas protegidas por rol
const ROLE_ROUTES: Record<string, string[]> = {
  "/admin": ["ADMIN"],
  "/professor": ["PROFESSOR"],
  "/student": ["STUDENT"],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // === 1. REDIRECCIÓN HTTPS (en producción) ===
  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("x-forwarded-proto") !== "https"
  ) {
    const url = new URL(request.url);
    url.protocol = "https";
    return NextResponse.redirect(url);
  }

  // === 2. PERMITIR RUTAS PÚBLICAS ===
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // === 3. VERIFICAR AUTENTICACIÓN ===
  const token = request.cookies.get("auth_token")?.value;
  const userRole = request.cookies.get("user_role")?.value;

  // Si no hay token y la ruta no es pública, redirigir al login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // === 4. VERIFICAR ACCESO POR ROL ===
  const matchedRoleRoute = Object.entries(ROLE_ROUTES).find(([route]) =>
    pathname.startsWith(route)
  );

  if (matchedRoleRoute) {
    const [, allowedRoles] = matchedRoleRoute;

    if (!userRole || !allowedRoles.includes(userRole.toUpperCase())) {
      // Redirigir al dashboard correspondiente según el rol
      if (userRole === "ADMIN") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      if (userRole === "PROFESSOR") {
        return NextResponse.redirect(new URL("/professor", request.url));
      }
      if (userRole === "STUDENT") {
        return NextResponse.redirect(new URL("/student", request.url));
      }
      // Sin rol válido, redirigir al login
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // === 5. AGREGAR HEADERS DE SEGURIDAD ===
  const response = NextResponse.next();

  // CSP (Content Security Policy) - report-only en desarrollo
  const cspMode = process.env.NODE_ENV === "production" ? "" : "-Report-Only";

  response.headers.set(
    `Content-Security-Policy${cspMode}`,
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https:",
      "connect-src 'self' https: wss: ws:",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "upgrade-insecure-requests",
    ].join("; ")
  );

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "0");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=(), fullscreen=(self)"
  );

  return response;
}

export const config = {
  matcher: [
    // Excluir archivos estáticos, API routes y _next
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$).*)",
  ],
};