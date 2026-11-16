import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";
import { isInvalidSession } from '@/lib/auth/session-error';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const publicRoutes = ["/login", "/cadastro", "/reset-password"];
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname);

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
    data: { user }, error,
  } = await supabase.auth.getUser();

  // A página distingue perfil ausente/inativo de falha transitória. Nunca
  // redirecionar /login para / apenas porque Auth tem um usuário.
  if (error && !isInvalidSession(error)) return supabaseResponse;
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
    return response;
  }

  return supabaseResponse;
}
