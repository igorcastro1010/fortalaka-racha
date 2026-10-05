import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const publicRoutes = ["/login", "/cadastro", "/reset-password"];
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname);
  const isLoginRoute = request.nextUrl.pathname === "/login";
  const isSignupRoute = request.nextUrl.pathname === "/cadastro";
  const isResetPasswordRoute = request.nextUrl.pathname === "/reset-password";

  if (!isSupabaseConfigured()) {
    if (!isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (isLoginRoute || isSignupRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (isResetPasswordRoute) {
    return supabaseResponse;
  }

  return supabaseResponse;
}
