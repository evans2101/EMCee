import type { NextRequest } from "next/server";
import { SESSION_COOKIES } from "@/lib/session-constants";
import {
	clearSession,
	failure,
	privateJson,
	tokenSession,
	upstreamJson,
	yukautoFetch,
} from "@/lib/server/yukauto";

type Context = { params: Promise<{ action: string }> };

export async function GET(request: NextRequest, context: Context) {
	const { action } = await context.params;
	if (action !== "session") return failure("Endpoint tidak ditemukan.", 404);
	const access = request.cookies.get(SESSION_COOKIES.access)?.value;
	const refresh = request.cookies.get(SESSION_COOKIES.refresh)?.value;
	if (!access && !refresh) return privateJson({ success: true, data: null });
	if (!access) return failure("Sesi perlu diperbarui.", 401);
	try {
		return await upstreamJson(
			await yukautoFetch("me", {
				headers: { Authorization: `Bearer ${access}` },
			}),
		);
	} catch {
		return failure(
			"Tidak dapat terhubung ke API Yukauto. Periksa konfigurasi server EMCee.",
			502,
		);
	}
}

export async function POST(request: NextRequest, context: Context) {
	if (request.headers.get("origin") !== request.nextUrl.origin)
		return failure("Origin permintaan tidak diizinkan.", 403);
	const { action } = await context.params;
	try {
		if (action === "login") {
			const body = await request.json().catch(() => null);
			if (
				!body ||
				typeof body.email !== "string" ||
				typeof body.password !== "string" ||
				!body.email.trim() ||
				!body.password ||
				body.email.length > 254 ||
				body.password.length > 1024 ||
				(body.turnstile_token !== undefined &&
					(typeof body.turnstile_token !== "string" ||
						body.turnstile_token.length > 8192))
			) {
				return failure(
					"Email dan kata sandi wajib diisi dengan format yang valid.",
					400,
				);
			}
			const upstream = await yukautoFetch("auth/login", {
				method: "POST",
				body: JSON.stringify({
					email: body.email.trim(),
					password: body.password,
					...(body.turnstile_token
						? { turnstile_token: body.turnstile_token }
						: {}),
				}),
			});
			return await tokenSession(upstream, body.remember_me === true);
		}
		if (action === "refresh") {
			const refresh = request.cookies.get(SESSION_COOKIES.refresh)?.value;
			if (!refresh)
				return clearSession(
					failure("Sesi berakhir. Silakan masuk kembali.", 401),
				);
			return await tokenSession(
				await yukautoFetch("auth/refresh", {
					method: "POST",
					body: JSON.stringify({ refresh_token: refresh }),
				}),
				request.cookies.get(SESSION_COOKIES.remember)?.value === "1",
			);
		}
		if (action === "logout") {
			const access = request.cookies.get(SESSION_COOKIES.access)?.value;
			if (access)
				await yukautoFetch("auth/logout", {
					method: "POST",
					headers: { Authorization: `Bearer ${access}` },
				}).catch(() => undefined);
			return clearSession(privateJson({ success: true, data: null }));
		}
		return failure("Endpoint tidak ditemukan.", 404);
	} catch {
		return failure(
			"Tidak dapat terhubung ke API Yukauto. Periksa konfigurasi server EMCee.",
			502,
		);
	}
}
