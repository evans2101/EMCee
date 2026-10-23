import type { NextRequest } from "next/server";
import { SESSION_COOKIES } from "@/lib/session-constants";
import {
	allowedMonitoringPath,
	failure,
	upstreamJson,
	yukautoFetch,
} from "@/lib/server/yukauto";

// This proxy can only read these three monitoring endpoints. Other methods return 405.
export async function GET(
	request: NextRequest,
	context: { params: Promise<{ path: string[] }> },
) {
	const path = (await context.params).path.join("/");
	if (!allowedMonitoringPath(path))
		return failure("Endpoint ini tidak tersedia di EMCee.", 404);
	const access = request.cookies.get(SESSION_COOKIES.access)?.value;
	if (!access) return failure("Silakan masuk ke EMCee.", 401);
	try {
		return await upstreamJson(
			await yukautoFetch(`${path}${request.nextUrl.search}`, {
				method: "GET",
				headers: { Authorization: `Bearer ${access}` },
			}),
		);
	} catch {
		return failure(
			"Data Yukauto belum dapat diambil. Periksa koneksi API di server EMCee.",
			502,
		);
	}
}
