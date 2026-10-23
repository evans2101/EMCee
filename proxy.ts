import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIES } from "@/lib/session-constants";

export function proxy(request: NextRequest) {
	const path = request.nextUrl.pathname;
	if (path === "/emcee/preview")
		return NextResponse.redirect(new URL("/preview", request.url));
	if (path === "/emcee")
		return NextResponse.redirect(new URL("/", request.url));
	if (
		path === "/" &&
		!request.cookies.has(SESSION_COOKIES.access) &&
		!request.cookies.has(SESSION_COOKIES.refresh)
	) {
		return NextResponse.redirect(new URL("/login", request.url));
	}
	return NextResponse.next();
}

export const config = { matcher: ["/", "/emcee", "/emcee/preview"] };
