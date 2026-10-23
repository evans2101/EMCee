import { afterEach, expect, it, vi } from "vitest";
import { authenticatedGet } from "@/lib/api/client";

afterEach(() => vi.unstubAllGlobals());

it("refreshes once and retries every original GET independently", async () => {
	const attempts = new Map<string, number>();
	let finishRefresh!: () => void;
	const gate = new Promise<void>((resolve) => {
		finishRefresh = resolve;
	});
	const fetch = vi.fn(async (input: string, options?: RequestInit) => {
		if (input === "/api/auth/refresh") {
			expect(options?.method).toBe("POST");
			await gate;
			return Response.json({ success: true, data: null });
		}
		expect(options?.method).toBe("GET");
		const attempt = (attempts.get(input) ?? 0) + 1;
		attempts.set(input, attempt);
		if (attempt === 1)
			return Response.json({ success: false }, { status: 401 });
		return Response.json({ success: true, data: { endpoint: input } });
	});
	vi.stubGlobal("fetch", fetch);
	const requests = Promise.all([
		authenticatedGet<{ endpoint: string }>("/overview", undefined, false),
		authenticatedGet<{ endpoint: string }>("/transactions", undefined, false),
	]);
	await vi.waitFor(() =>
		expect(
			fetch.mock.calls.filter(([path]) => path === "/api/auth/refresh"),
		).toHaveLength(1),
	);
	finishRefresh();
	const result = await requests;
	expect(result).toEqual([
		{ endpoint: "/overview" },
		{ endpoint: "/transactions" },
	]);
	expect(
		fetch.mock.calls.filter(([path]) => path === "/api/auth/refresh"),
	).toHaveLength(1);
});
