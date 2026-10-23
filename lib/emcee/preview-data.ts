// Isolated illustrative data. Imported only by the explicitly labelled preview.
import type { FinanceOverview as GatewayOverview } from "@/lib/api/tenant-finance";
import type {
	FinanceOverview,
	FinanceScope,
	MonitorTransaction,
	TransactionFilters,
	TransactionPage,
} from "./types";

const names = [
	"Arunika Group",
	"Nusantara Digital",
	"Sagara Network",
	"Lentera Indonesia",
	"Aksara Labs",
];
const tenants = names.map((name, i) => ({
	id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
	name,
}));

function transactions(scope: FinanceScope): MonitorTransaction[] {
	const start = new Date(`${scope.from_date}T00:00:00+07:00`).getTime();
	const days = Math.min(
		366,
		Math.max(
			0,
			Math.round(
				(new Date(`${scope.to_date}T00:00:00+07:00`).getTime() - start) /
					86400000,
			) + 1,
		),
	);
	return Array.from({ length: days * 28 }, (_, i) => {
		const n = i + 19;
		const tenant = tenants[n % tenants.length];
		const incoming = n % 10 < 5;
		const channel = !incoming && n % 3 !== 0 ? "gateway" : "device";
		const successful = n % 23 !== 0 && n % 37 !== 0;
		return {
			id: `demo-${String(n).padStart(6, "0")}`,
			tenant_id: tenant.id,
			tenant_name: tenant.name,
			external_ref: `YK-${String(n + 10241).padStart(8, "0")}`,
			direction: incoming ? "incoming" : "outgoing",
			channel,
			provider: channel === "gateway" ? ["apkita", "hilogate"][n % 2] : null,
			bank: ["BCA", "BRI", "MANDIRI", "BNI", "DANA"][n % 5],
			counterparty: [
				"Aditya Pratama",
				"Nadia Putri",
				"Rizky Saputra",
				"Dewi Anggraini",
				"Fajar Ramadhan",
			][n % 5],
			amount: (750 + ((n * 127 + Math.floor(i / 28) * 333) % 12000)) * 1000,
			fee: channel === "gateway" ? 2500 : 0,
			provider_fee: channel === "gateway" ? 1500 : null,
			successful,
			failed: !successful && n % 37 === 0,
			status: successful
				? incoming
					? "approved"
					: "completed"
				: n % 37 === 0
					? "failed"
					: "queued",
			device_id: channel === "device" ? `device-${n % 8}` : null,
			created_at: new Date(
				start + Math.floor(i / 28) * 86400000 + (i % 28) * 3000000,
			).toISOString(),
		} satisfies MonitorTransaction;
	}).filter(
		(row) =>
			(!scope.tenant_id || row.tenant_id === scope.tenant_id) &&
			(scope.source === "all" || row.channel === scope.source),
	);
}

export function previewOverview(scope: FinanceScope): FinanceOverview {
	const rows = transactions(scope);
	const sum = (list: MonitorTransaction[], direction: string) =>
		list.reduce(
			(total, row) =>
				total +
				(row.successful && row.direction === direction ? row.amount : 0),
			0,
		);
	const selectedTenants = tenants.filter(
		(t) => !scope.tenant_id || scope.tenant_id === t.id,
	);
	const chart = new Map<
		string,
		{ date: string; incoming: number; outgoing: number }
	>();
	for (const row of rows) {
		const date = new Date(new Date(row.created_at).getTime() + 7 * 3600000)
			.toISOString()
			.slice(0, 10);
		const point = chart.get(date) ?? { date, incoming: 0, outgoing: 0 };
		if (row.successful) point[row.direction] += row.amount;
		chart.set(date, point);
	}
	const channels = ["device", "apkita", "hilogate"]
		.map((key) => {
			const list = rows.filter((r) =>
				key === "device" ? r.channel === key : r.provider === key,
			);
			return {
				channel: key === "device" ? "device" : "gateway",
				provider: key === "device" ? null : key,
				incoming: sum(list, "incoming"),
				outgoing: sum(list, "outgoing"),
				total_count: list.length,
				success_count: list.filter((r) => r.successful).length,
				failed_count: list.filter((r) => r.failed).length,
				pending_count: list.filter((r) => !r.successful && !r.failed).length,
			};
		})
		.filter((c) => c.total_count);
	const devices =
		scope.source === "gateway"
			? []
			: selectedTenants.flatMap((tenant, i) =>
					Array.from({ length: 3 }, (_, j) => ({
						id: `device-${i * 3 + j}`,
						tenant_id: tenant.id,
						tenant_name: tenant.name,
						device_name: `YKA-${String(i * 3 + j + 1).padStart(3, "0")}`,
						device_model: j % 2 ? "Samsung Galaxy A15" : "Samsung Galaxy A24",
						status: "active",
						online: !(i === 2 && j === 2),
						last_seen_at: new Date(
							Date.now() - (i === 2 && j === 2 ? 7200000 : 60000),
						).toISOString(),
					})),
				);
	return {
		summary: {
			incoming: sum(rows, "incoming"),
			outgoing: sum(rows, "outgoing"),
			total_count: rows.length,
			success_count: rows.filter((r) => r.successful).length,
			failed_count: rows.filter((r) => r.failed).length,
			pending_count: rows.filter((r) => !r.successful && !r.failed).length,
			admin_fee: rows
				.filter((r) => r.successful)
				.reduce((s, r) => s + r.fee, 0),
			margin: rows
				.filter((r) => r.successful && r.provider_fee !== null)
				.reduce((s, r) => s + r.fee - (r.provider_fee ?? 0), 0),
			unsettled_fee_count: 0,
		},
		chart: Array.from(chart.values()),
		channels,
		tenants: selectedTenants
			.map((t) => {
				const list = rows.filter((r) => r.tenant_id === t.id);
				return {
					tenant_id: t.id,
					tenant_name: t.name,
					incoming: sum(list, "incoming"),
					outgoing: sum(list, "outgoing"),
					total_count: list.length,
					pending_count: list.filter((r) => !r.successful && !r.failed).length,
				};
			})
			.sort((a, b) => b.incoming + b.outgoing - a.incoming - a.outgoing),
		tenant_options: tenants,
		devices,
		banks: devices.map((device, i) => ({
			id: `bank-${i}`,
			tenant_id: device.tenant_id,
			tenant_name: device.tenant_name,
			bank: ["BCA", "BRI", "MANDIRI"][i % 3],
			account_number_masked: `•••• ${4210 + i}`,
			account_name: device.tenant_name,
			balance: 41000000 + i * 7300000,
			last_balance_update: device.last_seen_at,
			device_id: device.id,
			device_name: device.device_name,
			stale: !device.online,
		})),
		wallet_balance:
			scope.source === "device" ? 0 : selectedTenants.length * 218500000,
		generated_at: new Date().toISOString(),
		timezone: "Asia/Jakarta",
	};
}

export function previewTransactions(
	scope: FinanceScope,
	filters: TransactionFilters,
): TransactionPage {
	const rows = transactions(scope)
		.filter(
			(row) =>
				(filters.direction === "all" || row.direction === filters.direction) &&
				(filters.status === "all" ||
					(filters.status === "success"
						? row.successful
						: filters.status === "failed"
							? row.failed
							: !row.successful && !row.failed)) &&
				`${row.external_ref} ${row.tenant_name} ${row.counterparty} ${row.id}`
					.toLowerCase()
					.includes(filters.search.toLowerCase()),
		)
		.sort(
			(a, b) =>
				b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
		);
	return {
		rows: rows.slice(filters.offset, filters.offset + 20),
		total: rows.length,
		limit: 20,
		offset: filters.offset,
	};
}

export function previewGateway(scope: FinanceScope): GatewayOverview {
	return {
		providers: ["apkita", "hilogate"].map((provider, i) => ({
			provider,
			profile_id: null,
			merchant_id: `DEMO-${i + 1}`,
			merchant_name: `${provider.toUpperCase()} Merchant`,
			real_balance: 420000000 + i * 175000000,
			pending_balance: i * 12000000,
			live: true,
		})),
		tenants: tenants
			.filter((t) => !scope.tenant_id || t.id === scope.tenant_id)
			.map((t) => ({
				tenant_id: t.id,
				tenant_name: t.name,
				balance: 218500000,
				withdrawal_fee: 2500,
				total_topup: 980000000,
				total_withdraw: 740000000,
				total_admin_fee: 21500000,
				total_revenue: 8600000,
				unsettled_fee_count: 0,
				reserved: 26000000,
				effective_provider: "apkita",
				apkita_profile_id: null,
			})),
	};
}
