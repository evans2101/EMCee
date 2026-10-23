import type { ApiResponse } from "@/lib/types/api";

export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly code?: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

async function parse<T>(response: Response): Promise<T> {
	const body = (await response
		.json()
		.catch(() => null)) as ApiResponse<T> | null;
	if (!response.ok || !body?.success)
		throw new ApiError(
			body?.error?.message ?? "Permintaan gagal diproses.",
			response.status,
			body?.error?.code,
		);
	return body.data as T;
}

let refreshing: Promise<void> | null = null;
async function refreshSession() {
	if (!refreshing) {
		refreshing = (async () => {
			await parse(
				await fetch("/api/auth/refresh", {
					method: "POST",
					credentials: "same-origin",
					cache: "no-store",
				}),
			);
		})().finally(() => {
			refreshing = null;
		});
	}
	return refreshing;
}

export async function authenticatedGet<T>(
	url: string,
	signal?: AbortSignal,
	redirectOnExpiry = true,
): Promise<T> {
	const options = {
		method: "GET",
		credentials: "same-origin" as const,
		cache: "no-store" as const,
		signal,
	};
	let response = await fetch(url, options);
	if (response.status === 401) {
		try {
			await refreshSession();
			// Retry each caller's original URL after the shared refresh finishes.
			response = await fetch(url, options);
		} catch (error) {
			if (
				redirectOnExpiry &&
				error instanceof ApiError &&
				[401, 403].includes(error.status) &&
				typeof window !== "undefined"
			)
				window.location.assign("/login");
			throw error;
		}
	}
	if (
		response.status === 401 &&
		redirectOnExpiry &&
		typeof window !== "undefined"
	)
		window.location.assign("/login");
	return parse<T>(response);
}

export async function authPost<T>(
	action: "login" | "logout",
	body?: unknown,
): Promise<T> {
	return parse<T>(
		await fetch(`/api/auth/${action}`, {
			method: "POST",
			credentials: "same-origin",
			cache: "no-store",
			headers: { "Content-Type": "application/json" },
			...(body ? { body: JSON.stringify(body) } : {}),
		}),
	);
}

export function getApiData<T>(
	path: string,
	params: Record<string, string | number> = {},
	signal?: AbortSignal,
) {
	const query = new URLSearchParams(
		Object.entries(params).map(([key, value]) => [key, String(value)]),
	);
	return authenticatedGet<T>(
		`/api/yukauto/${path}${query.size ? `?${query}` : ""}`,
		signal,
	);
}
