import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as monitoring from "@/app/api/yukauto/[...path]/route";
import { POST as authPost } from "@/app/api/auth/[action]/route";
import { allowedMonitoringPath, tokenSession } from "@/lib/server/yukauto";

const context = (path: string) => ({
	params: Promise.resolve({ path: path.split("/") }),
});
const user = {
	id: "qa-user",
	name: "QA Master",
	email: "qa@example.test",
	tenant_id: null,
	roles: ["master"],
};
const tokens = (permissions = ["master:tenant_management"]) =>
	Response.json({
		success: true,
		data: {
			access_token: "qa-access",
			refresh_token: "qa-refresh",
			user,
			permissions,
		},
	});

beforeEach(() =>
	vi.stubEnv("YUKAUTO_API_URL", "https://api.example.test/api/v1"),
);
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("read-only monitoring boundary", () => {
	it("only exposes GET and exactly the monitoring allowlist", () => {
		expect(Object.keys(monitoring)).toEqual(["GET"]);
		expect(allowedMonitoringPath("master/monitoring/finance")).toBe(true);
		expect(
			allowedMonitoringPath("master/monitoring/finance/transactions"),
		).toBe(true);
		expect(allowedMonitoringPath("master/tenants/financial-overview")).toBe(
			true,
		);
		for (const path of [
			"withdrawals",
			"master/tenants/id/wallet/topups",
			"../auth/login",
			"master/monitoring/finance/../broadcast",
		])
			expect(allowedMonitoringPath(path)).toBe(false);
	});

	it("rejects anonymous data requests before contacting Yukauto", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		const response = await monitoring.GET(
			new NextRequest("http://localhost/api/yukauto/master/monitoring/finance"),
			context("master/monitoring/finance"),
		);
		expect(response.status).toBe(401);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("cannot proxy arbitrary Yukauto endpoints even with a session", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		const response = await monitoring.GET(
			new NextRequest("http://localhost/api/yukauto/withdrawals", {
				headers: { Cookie: "emcee_access=qa" },
			}),
			context("withdrawals"),
		);
		expect(response.status).toBe(404);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("forwards each GET scope and keeps the response private and uncached", async () => {
		const fetch = vi.fn(async (_url: string, _options?: RequestInit) =>
			Response.json({ success: true, data: { summary: { incoming: 42 } } }),
		);
		vi.stubGlobal("fetch", fetch);
		const response = await monitoring.GET(
			new NextRequest(
				"http://localhost/api/yukauto/master/monitoring/finance?source=gateway&tenant_id=qa",
				{ headers: { Cookie: "emcee_access=qa" } },
			),
			context("master/monitoring/finance"),
		);
		expect(fetch).toHaveBeenCalledWith(
			"https://api.example.test/api/v1/master/monitoring/finance?source=gateway&tenant_id=qa",
			expect.objectContaining({
				method: "GET",
				cache: "no-store",
				redirect: "error",
			}),
		);
		const options = fetch.mock.calls[0][1] as RequestInit;
		expect(new Headers(options.headers).get("Authorization")).toBe("Bearer qa");
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect((await response.json()).data.summary.incoming).toBe(42);
	});

	it("rejects cross-origin authentication writes", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		const response = await authPost(
			new NextRequest("http://localhost/api/auth/login", {
				method: "POST",
				headers: { Origin: "https://unrelated.example" },
			}),
			{ params: Promise.resolve({ action: "login" }) },
		);
		expect(response.status).toBe(403);
		expect(fetch).not.toHaveBeenCalled();
	});
});

describe("session confidentiality", () => {
	it("keeps tokens in HttpOnly cookies, never in the JSON response", async () => {
		vi.stubEnv("NODE_ENV", "production");
		const response = await tokenSession(tokens(), true);
		expect(response.cookies.get("emcee_access")).toMatchObject({
			value: "qa-access",
			httpOnly: true,
			secure: true,
			sameSite: "strict",
		});
		expect(response.cookies.get("emcee_refresh")).toMatchObject({
			value: "qa-refresh",
			httpOnly: true,
			maxAge: 604800,
		});
		const json = await response.json();
		expect(json.data.name).toBe("QA Master");
		expect(JSON.stringify(json)).not.toContain("qa-access");
		expect(JSON.stringify(json)).not.toContain("qa-refresh");
	});

	it("does not persist cookies when remember-me is disabled", async () => {
		const response = await tokenSession(tokens(), false);
		expect(response.cookies.get("emcee_refresh")?.maxAge).toBeUndefined();
	});

	it("rejects tenant-only roles and clears access cookies", async () => {
		const response = await tokenSession(tokens(["deposit:read"]), false);
		expect(response.status).toBe(403);
		expect(response.cookies.get("emcee_access")?.maxAge).toBe(0);
	});

	it("preserves existing sessions during an upstream outage", async () => {
		const response = await tokenSession(
			new Response("unavailable", { status: 503 }),
			true,
		);
		expect(response.status).toBe(502);
		expect(response.cookies.getAll()).toHaveLength(0);
	});
});
