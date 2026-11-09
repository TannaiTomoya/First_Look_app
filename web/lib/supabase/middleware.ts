import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";

/** 未ログインで入れないパスのみ。ここに無いページは getUser を呼ばない（CPU節約） */
const protectedPrefixes = [
  "/dashboard",
  "/capture",
  "/records",
  "/progress",
  "/settings",
  "/admin",
  "/onboarding",
  "/consult",
  "/growth",
  "/skin",
  "/skin-check",
  "/shorts",
  "/intro",
  "/physiognomy",
  "/beauty-info",
  "/konkatsu",
  "/studio",
  "/future-face",
];

const authPages = ["/login", "/register"];

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((p) => path.startsWith(p));
  const isAuthPage = authPages.some((p) => path === p || path.startsWith(`${p}/`));

  // 公開ページ（LP・料金など）は認証処理を完全スキップ → Error 1102 対策
  if (!isProtected && !isAuthPage) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
