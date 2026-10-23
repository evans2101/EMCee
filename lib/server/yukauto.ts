import { NextResponse } from "next/server";
import { hasMasterAccess } from "@/lib/auth";
import { SESSION_COOKIES } from "@/lib/session-constants";
import type { ApiResponse } from "@/lib/types/api";
import type { CurrentUser, TokenResponse } from "@/lib/types/auth";

const MONITORING_PATHS = new Set([
	"master/monitoring/finance",
	"master/monitoring/finance/transactions",
	"master/tenants/financial-overview",
]);

export function allowedMonitoringPath(path: string): boolean {
	return MONITORING_PATHS.has(path);
}

export function privateJson<T>(body: T, status = 200) {
	return NextResponse.json(body, {
		status,
		headers: {
			"Cache-Control": "private, no-store, max-age=0",
			Vary: "Cookie",
		},
	});
}

export function failure(message: string, status: number) {
	return privateJson(
		{ success: false, error: { code: `EMCEE_${status}`, message } },
		status,
	);
}

export async function yukautoFetch(path: string, options: RequestInit = {}) {
	const configured = process.env.YUKAUTO_API_URL?.trim();
	if (!configured)
		throw new Error("YUKAUTO_API_URL belum dikonfigurasi di server EMCee.");
	const base = new URL(configured);
	if (
		!["http:", "https:"].includes(base.protocol) ||
		base.username ||
		base.password
	) {
		throw new Error(
			"YUKAUTO_API_URL harus berupa URL HTTP/HTTPS tanpa kredensial.",
		);
	}
	const headers = new Headers(options.headers);
	headers.set("Accept", "application/json");
	headers.set("Accept-Language", "id");
	if (options.body) headers.set("Content-Type", "application/json");
	return fetch(`${base.toString().replace(/\/$/, "")}/${path}`, {
		...options,
		headers,
		cache: "no-store",
		redirect: "error",
		signal: options.signal ?? AbortSignal.timeout(20000),
	});
}

export async function upstreamJson(response: Response) {
	if (response.status >= 500)
		return failure("API Yukauto belum dapat memproses permintaan.", 502);
	const body = await response.json().catch(() => null);
	if (!body || typeof body.success !== "boolean")
		return failure("Respons API Yukauto tidak valid.", 502);
	return privateJson(body, response.status);
}

export function clearSession(response: NextResponse) {
	for (const name of Object.values(SESSION_COOKIES)) {
		response.cookies.set(name, "", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			path: "/",
			maxAge: 0,
		});
	}
	return response;
}

export async function tokenSession(upstream: Response, remember: boolean) {
	if (!upstream.ok) {
		const response = await upstreamJson(upstream);
		return [400, 401, 403].includes(upstream.status)
			? clearSession(response)
			: response;
	}
	const envelope = (await upstream.json()) as ApiResponse<TokenResponse>;
	const tokens = envelope.data;
	if (
		!envelope.success ||
		!tokens?.access_token ||
		!tokens.refresh_token ||
		!tokens.user ||
		!Array.isArray(tokens.permissions)
	) {
		return clearSession(
			failure("Respons autentikasi Yukauto tidak lengkap.", 502),
		);
	}
	const user: CurrentUser = { ...tokens.user, permissions: tokens.permissions };
	if (!hasMasterAccess(user))
		return clearSession(
			failure("Akun ini belum memiliki akses monitoring master Yukauto.", 403),
		);
	const response = privateJson({ success: true, data: user });
	const options = {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict" as const,
		path: "/",
	};
	let accessSeconds = 900;
	try {
		const exp: unknown = JSON.parse(
			Buffer.from(tokens.access_token.split(".")[1], "base64url").toString(),
		).exp;
		if (typeof exp === "number")
			accessSeconds = Math.max(
				1,
				Math.min(86400, exp - Math.floor(Date.now() / 1000)),
			);
	} catch {
		/* Unknown token encoding: use the conservative default cookie lifetime. */
	}
	response.cookies.set(SESSION_COOKIES.access, tokens.access_token, {
		...options,
		...(remember ? { maxAge: accessSeconds } : {}),
	});
	response.cookies.set(SESSION_COOKIES.refresh, tokens.refresh_token, {
		...options,
		...(remember ? { maxAge: 7 * 86400 } : {}),
	});
	response.cookies.set(SESSION_COOKIES.remember, remember ? "1" : "0", {
		...options,
		...(remember ? { maxAge: 7 * 86400 } : {}),
	});
	return response;
}
