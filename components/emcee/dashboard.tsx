"use client";

import * as Popover from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	ArrowDownLeft,
	ArrowRight,
	ArrowUpRight,
	Bell,
	Building2,
	CalendarDays,
	Check,
	CheckCheck,
	ChevronDown,
	CircleHelp,
	Download,
	ExternalLink,
	Layers3,
	LayoutDashboard,
	LogOut,
	Menu,
	Radio,
	RefreshCw,
	ShieldCheck,
	Smartphone,
	Wallet,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { tenantFinanceApi } from "@/lib/api/tenant-finance";
import { emceeApi } from "@/lib/emcee/api";
import {
	compact,
	dateLabel,
	downloadCsv,
	number,
	periodDates,
	rupiah,
	timestamp,
} from "@/lib/emcee/format";
import type {
	FinanceOverview,
	FinanceScope,
	TransactionFilters,
} from "@/lib/emcee/types";
import { hasMasterAccess } from "@/lib/auth";
import { TransactionTable } from "./transaction-table";

const CashflowChart = dynamic(() => import("./cashflow-chart"), {
	ssr: false,
	loading: () => (
		<div className="em-card em-chart-loading">Menyiapkan grafik...</div>
	),
});
type Tab = "overview" | "transactions" | "gateway" | "devices";
const nav = [
	{ id: "overview" as const, label: "Ringkasan", icon: LayoutDashboard },
	{ id: "transactions" as const, label: "Semua transaksi", icon: ArrowRight },
	{ id: "gateway" as const, label: "Payment Gateway", icon: Layers3 },
	{ id: "devices" as const, label: "Bank & Device", icon: Smartphone },
];
const titles = {
	overview: [
		"Ringkasan keuangan",
		"Setiap pergerakan uang. Satu pandangan menyeluruh.",
	],
	transactions: [
		"Semua transaksi",
		"Telusuri arus uang di seluruh ekosistem Yukauto.",
	],
	gateway: [
		"Payment Gateway",
		"Saldo merchant, wallet tenant, dan performa disbursement.",
	],
	devices: [
		"Bank & Device",
		"Pantau saldo rekening dan konektivitas device Yukauto.",
	],
};
const palette = ["#2f745a", "#a4bea2", "#d7b98d", "#a7b3c6", "#d3a5ac"];

function Metric({
	label,
	value,
	icon: Icon,
	tone,
	foot,
	points,
}: {
	label: string;
	value: string;
	icon: typeof Wallet;
	tone: string;
	foot: string;
	points: number[];
}) {
	const max = Math.max(...points, 1);
	const line = points
		.map(
			(value, i) =>
				`${(i * 90) / Math.max(points.length - 1, 1)},${29 - (value / max) * 25}`,
		)
		.join(" ");
	return (
		<article className={`em-card em-metric ${tone}`}>
			<div className="em-metric-top">
				<span>{label}</span>
				<span className="em-metric-icon">
					<Icon size={17} />
				</span>
			</div>
			<strong className="em-metric-value" title={value}>
				{value}
			</strong>
			<div className="em-metric-bottom">
				<span>{foot}</span>
				{points.length ? (
					<svg viewBox="0 0 90 32" aria-hidden="true">
						<polyline
							points={line}
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				) : null}
			</div>
		</article>
	);
}

function ChannelComposition({ data }: { data?: FinanceOverview }) {
	const channels = data?.channels ?? [];
	const total = channels.reduce((sum, c) => sum + c.incoming + c.outgoing, 0);
	let edge = 0;
	const stops = channels.map((c, i) => {
		const start = edge;
		edge += total ? ((c.incoming + c.outgoing) / total) * 100 : 0;
		return `${palette[i % palette.length]} ${start}% ${edge}%`;
	});
	return (
		<section className="em-card em-composition">
			<div className="em-card-heading">
				<div>
					<h2>Komposisi channel</h2>
					<p>Berdasarkan volume transaksi berhasil</p>
				</div>
				<Layers3 size={18} className="em-muted" />
			</div>
			<div
				className="em-donut"
				style={{
					background: total ? `conic-gradient(${stops.join(",")})` : "#eef1ec",
				}}
				role="img"
				aria-label={`Volume seluruh channel ${rupiah(total)}`}
			>
				<div>
					<span>Total volume</span>
					<strong>Rp {compact(total)}</strong>
					<small>masuk + keluar</small>
				</div>
			</div>
			<div className="em-channel-legend">
				{channels.length ? (
					channels.map((c, i) => (
						<div key={`${c.channel}-${c.provider}`}>
							<span>
								<i style={{ background: palette[i % palette.length] }} />
								{c.channel === "device"
									? "Bank Device"
									: (c.provider?.toUpperCase() ?? "Payment Gateway")}
							</span>
							<strong>
								{total
									? (((c.incoming + c.outgoing) / total) * 100).toLocaleString(
											"id-ID",
											{
												maximumFractionDigits: 1,
											},
										)
									: 0}
								%
							</strong>
						</div>
					))
				) : (
					<p className="em-muted">Belum ada volume pada periode ini.</p>
				)}
			</div>
		</section>
	);
}

export function EmceeDashboard({
	preview = false,
	yukautoUrl,
}: {
	preview?: boolean;
	yukautoUrl?: string;
}) {
	const { currentUser, isAuthLoading, logout } = useAuth();
	const authorized = !isAuthLoading && hasMasterAccess(currentUser);
	const [tab, setTab] = useState<Tab>("overview");
	const [scope, setScope] = useState<FinanceScope>(() => ({
		...periodDates(),
		source: "all",
		tenant_id: "",
	}));
	const [filters, setFilters] = useState<TransactionFilters>({
		search: "",
		status: "all",
		direction: "all",
		offset: 0,
	});
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [automatic, setAutomatic] = useState(true);
	const [mobileNav, setMobileNav] = useState(false);
	const [dateOpen, setDateOpen] = useState(false);
	const [dateDraft, setDateDraft] = useState({
		from_date: scope.from_date,
		to_date: scope.to_date,
	});
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
		return () => clearTimeout(timer);
	}, [filters.search]);
	const enabled =
		(preview || authorized) && !!scope.from_date && !!scope.to_date;
	const interval = automatic ? 30000 : false;
	const overview = useQuery({
		queryKey: ["emcee", preview, "overview", scope],
		queryFn: async ({ signal }) =>
			preview
				? (await import("@/lib/emcee/preview-data")).previewOverview(scope)
				: emceeApi.overview(scope, signal),
		enabled,
		refetchInterval: interval,
		retry: 1,
	});
	const queryFilters = { ...filters, search: debouncedSearch };
	const transactions = useQuery({
		queryKey: ["emcee", preview, "transactions", scope, queryFilters],
		queryFn: async ({ signal }) =>
			preview
				? (await import("@/lib/emcee/preview-data")).previewTransactions(
						scope,
						queryFilters,
					)
				: emceeApi.transactions(scope, queryFilters, signal),
		enabled,
		refetchInterval: interval,
		retry: 1,
	});
	const gateways = useQuery({
		queryKey: ["emcee", preview, "gateways", scope.tenant_id],
		queryFn: async () =>
			preview
				? (await import("@/lib/emcee/preview-data")).previewGateway(scope)
				: tenantFinanceApi.overview(scope.tenant_id || undefined),
		enabled: enabled && scope.source !== "device",
		refetchInterval: automatic ? 60000 : false,
		retry: 1,
	});
	const data = overview.data;
	const summary = overview.isError ? undefined : data?.summary;
	const bankBalance =
		data?.banks.reduce((sum, bank) => sum + (bank.balance ?? 0), 0) ?? 0;
	const online = data?.devices.filter((device) => device.online).length ?? 0;
	const offline = (data?.devices.length ?? 0) - online;
	const successRate = summary?.total_count
		? ((summary.success_count / summary.total_count) * 100).toLocaleString(
				"id-ID",
				{
					maximumFractionDigits: 1,
				},
			)
		: "0";
	const sync =
		overview.isFetching ||
		transactions.isFetching ||
		(scope.source !== "device" && gateways.isFetching);

	function changeScope(patch: Partial<FinanceScope>) {
		setScope((previous) => ({ ...previous, ...patch }));
		setFilters((previous) => ({ ...previous, offset: 0 }));
	}
	function selectTab(next: Tab) {
		setTab(next);
		setMobileNav(false);
		if (next === "gateway") changeScope({ source: "gateway" });
		else if (next === "devices") changeScope({ source: "device" });
		else if (next === "overview") changeScope({ source: "all" });
	}
	function exportOverview() {
		if (!data || overview.isError) return;
		downloadCsv(`EMCee-ringkasan-${scope.from_date}-${scope.to_date}.csv`, [
			["EMCee", preview ? "DEMO — DATA ILUSTRASI" : "Yukauto"],
			["Periode WIB", scope.from_date, scope.to_date],
			["Channel", scope.source],
			["Snapshot", data.generated_at],
			["Uang masuk berhasil IDR", data.summary.incoming],
			["Uang keluar berhasil IDR", data.summary.outgoing],
			["Arus bersih IDR", data.summary.incoming - data.summary.outgoing],
			["Admin PG IDR", data.summary.admin_fee],
			["Margin PG terkonfirmasi IDR", data.summary.margin],
			[
				"Biaya provider belum final (transaksi)",
				data.summary.unsettled_fee_count,
			],
			[],
			[
				"Tenant",
				"Uang masuk IDR",
				"Uang keluar IDR",
				"Arus bersih IDR",
				"Total transaksi",
				"Dalam proses",
			],
			...data.tenants.map((t) => [
				t.tenant_name,
				t.incoming,
				t.outgoing,
				t.incoming - t.outgoing,
				t.total_count,
				t.pending_count,
			]),
		]);
	}
	const invalidDates =
		!dateDraft.from_date ||
		!dateDraft.to_date ||
		dateDraft.from_date > dateDraft.to_date ||
		(new Date(dateDraft.to_date).getTime() -
			new Date(dateDraft.from_date).getTime()) /
			86400000 >
			365;

	if (!preview && (isAuthLoading || !authorized))
		return (
			<main className="em-access">
				<div className="em-brand-mark">
					e<span>↗</span>
				</div>
				<h1>EMCee</h1>
				<p>
					{isAuthLoading
						? "Memverifikasi akses Yukauto..."
						: "EMCee tersedia untuk akun master Yukauto."}
				</p>
				{!isAuthLoading ? (
					<Link className="em-button primary" href="/login">
						Masuk ke EMCee
						<ArrowRight size={16} />
					</Link>
				) : null}
			</main>
		);

	return (
		<div className="em-app">
			{mobileNav ? (
				<button
					type="button"
					className="em-mobile-overlay"
					aria-label="Tutup navigasi"
					onClick={() => setMobileNav(false)}
				/>
			) : null}
			<aside className={`em-sidebar ${mobileNav ? "open" : ""}`}>
				<Link href={preview ? "/preview" : "/"} className="em-brand">
					<span className="em-brand-mark">
						e<span>↗</span>
					</span>
					<span>
						EMCee<small>EXECUTIVE MONITOR</small>
					</span>
				</Link>
				<div className="em-workspace">
					<span className="em-workspace-logo">Y</span>
					<div>
						<strong>Yukauto</strong>
						<span>Finance workspace</span>
					</div>
					<ShieldCheck size={16} />
				</div>
				<span className="em-nav-label">WORKSPACE</span>
				<nav aria-label="Navigasi EMCee">
					{nav.map((item) => (
						<button
							key={item.id}
							type="button"
							className={tab === item.id ? "active" : ""}
							aria-current={tab === item.id ? "page" : undefined}
							onClick={() => selectTab(item.id)}
						>
							<item.icon size={18} />
							<span>{item.label}</span>
							{tab === item.id ? <i /> : null}
						</button>
					))}
				</nav>
				<div className="em-sidebar-note">
					<Radio size={20} />
					<strong>Clarity in every flow.</strong>
					<p>Seluruh arus uang Yukauto, terhubung dalam satu pandangan.</p>
					<span>
						<ShieldCheck size={13} />
						Monitoring only
					</span>
				</div>
				<div className="em-sidebar-bottom">
					{!preview ? (
						<button
							type="button"
							className="em-logout"
							onClick={() => void logout()}
						>
							<LogOut size={15} />
							Keluar dari EMCee
						</button>
					) : null}
					<Link href={preview ? "/login" : yukautoUrl || "/preview"}>
						<ExternalLink size={16} />
						{preview
							? "Masuk ke data Yukauto"
							: yukautoUrl
								? "Buka Yukauto"
								: "Lihat mode preview"}
						<ArrowUpRight size={14} />
					</Link>
					<div className="em-user">
						<span>
							{preview
								? "EX"
								: (currentUser?.name ?? "EX").slice(0, 2).toUpperCase()}
						</span>
						<div>
							<strong>
								{preview ? "Executive Preview" : currentUser?.name}
							</strong>
							<small>{preview ? "Data ilustrasi" : "Master workspace"}</small>
						</div>
						<ShieldCheck size={17} />
					</div>
				</div>
			</aside>
			<div className="em-main">
				<header className="em-topbar">
					<div>
						<button
							type="button"
							className="em-icon-button em-mobile-menu"
							aria-label="Buka navigasi"
							onClick={() => setMobileNav(true)}
						>
							<Menu size={20} />
						</button>
						<span className="em-breadcrumb">
							Workspace <span>/</span>{" "}
							<strong>{nav.find((item) => item.id === tab)?.label}</strong>
						</span>
					</div>
					<div className="em-top-actions">
						<span
							className={`em-live ${preview ? "demo" : overview.isError ? "error" : ""}`}
						>
							<i />
							{preview
								? "Demo · data ilustrasi"
								: overview.isError
									? "Koneksi terputus"
									: overview.isSuccess
										? "Terhubung ke Yukauto"
										: "Menghubungkan..."}
						</span>
						<span className="em-top-divider" />
						<Popover.Root>
							<Popover.Trigger asChild>
								<button
									type="button"
									className="em-icon-button"
									aria-label="Informasi monitoring"
								>
									<CircleHelp size={18} />
								</button>
							</Popover.Trigger>
							<Popover.Portal>
								<Popover.Content
									className="emcee-root em-info-popover"
									sideOffset={12}
								>
									<strong>Tentang angka di EMCee</strong>
									<p>
										Arus uang memakai nominal pokok transaksi berhasil
										berdasarkan waktu pencatatan, zona WIB. Biaya admin
										ditampilkan terpisah.
									</p>
									<p>
										Saldo rekening, wallet tenant, dan saldo merchant PG adalah
										snapshot terkini, terpisah dari filter periode. Saldo
										merchant dan wallet tidak dijumlahkan.
									</p>
									<p>
										EMCee mengambil data monitoring melalui GET. Login dan
										pembaruan sesi mengikuti autentikasi Yukauto.
									</p>
									<Popover.Arrow fill="white" />
								</Popover.Content>
							</Popover.Portal>
						</Popover.Root>
						<button
							type="button"
							className="em-top-avatar"
							aria-label="Lihat status operasional"
							onClick={() =>
								document
									.getElementById("em-attention")
									?.scrollIntoView({ behavior: "smooth", block: "center" })
							}
						>
							<Bell size={18} />
							{(summary?.pending_count ?? 0) + offline > 0 ? <i /> : null}
						</button>
					</div>
				</header>
				<main className="em-content">
					{preview ? (
						<div className="em-demo-banner">
							<span>
								<ShieldCheck size={15} />
								<strong>Preview EMCee</strong> · Seluruh angka di halaman ini
								adalah ilustrasi.
							</span>
							<Link href="/">
								Hubungkan data Yukauto
								<ArrowUpRight size={14} />
							</Link>
						</div>
					) : null}
					<div className="em-page-heading">
						<div>
							<div className="em-eyebrow">
								<span />
								YUKAUTO INTELLIGENCE
							</div>
							<h1>
								{titles[tab][0]}
								<span>.</span>
							</h1>
							<p>{titles[tab][1]}</p>
						</div>
						<button
							type="button"
							className="em-button primary"
							onClick={exportOverview}
							disabled={!data || overview.isError}
						>
							<Download size={16} />
							Unduh ringkasan
						</button>
					</div>
					<div className="em-filterbar">
						<div
							className="em-scope-tabs"
							role="group"
							aria-label="Filter channel"
						>
							{(
								[
									{
										value: "all",
										label: "Semua channel",
										icon: LayoutDashboard,
									},
									{ value: "gateway", label: "Payment Gateway", icon: Layers3 },
									{ value: "device", label: "Bank Device", icon: Smartphone },
								] as const
							).map((item) => (
								<button
									type="button"
									key={item.value}
									className={scope.source === item.value ? "active" : ""}
									aria-pressed={scope.source === item.value}
									onClick={() => changeScope({ source: item.value })}
								>
									<item.icon size={14} />
									{item.label}
								</button>
							))}
						</div>
						<div className="em-scope-controls">
							<label className="em-select-wrap">
								<Building2 size={14} />
								<select
									aria-label="Filter tenant"
									value={scope.tenant_id}
									onChange={(e) => changeScope({ tenant_id: e.target.value })}
								>
									<option value="">Semua tenant</option>
									{data?.tenant_options.map((t) => (
										<option key={t.id} value={t.id}>
											{t.name}
										</option>
									))}
								</select>
							</label>
							<Popover.Root
								open={dateOpen}
								onOpenChange={(open) => {
									setDateOpen(open);
									if (open)
										setDateDraft({
											from_date: scope.from_date,
											to_date: scope.to_date,
										});
								}}
							>
								<Popover.Trigger asChild>
									<button type="button" className="em-button em-date-button">
										<CalendarDays size={14} />
										{dateLabel(scope.from_date)} – {dateLabel(scope.to_date)}{" "}
										{scope.to_date.slice(0, 4)}
										<ChevronDown size={12} />
									</button>
								</Popover.Trigger>
								<Popover.Portal>
									<Popover.Content
										align="end"
										sideOffset={8}
										className="emcee-root em-date-popover"
									>
										<h3>Periode monitoring</h3>
										<p>Tanggal inklusif · Asia/Jakarta (WIB)</p>
										<div className="em-date-presets">
											{[1, 7, 30].map((days) => (
												<button
													type="button"
													key={days}
													onClick={() => {
														const range = periodDates(days);
														changeScope(range);
														setDateDraft(range);
														setDateOpen(false);
													}}
												>
													{days === 1 ? "Hari ini" : `${days} hari terakhir`}
												</button>
											))}
										</div>
										<label>
											Dari tanggal
											<input
												type="date"
												value={dateDraft.from_date}
												onChange={(e) =>
													setDateDraft({
														...dateDraft,
														from_date: e.target.value,
													})
												}
											/>
										</label>
										<label>
											Sampai tanggal
											<input
												type="date"
												value={dateDraft.to_date}
												onChange={(e) =>
													setDateDraft({
														...dateDraft,
														to_date: e.target.value,
													})
												}
											/>
										</label>
										{invalidDates ? (
											<p className="em-error-text">
												Pilih rentang tanggal yang valid, maksimal 366 hari.
											</p>
										) : null}
										<button
											type="button"
											className="em-button primary"
											disabled={invalidDates}
											onClick={() => {
												changeScope(dateDraft);
												setDateOpen(false);
											}}
										>
											Terapkan periode
											<Check size={14} />
										</button>
									</Popover.Content>
								</Popover.Portal>
							</Popover.Root>
							<button
								type="button"
								className="em-icon-button em-sync-button"
								title="Sinkronkan sekarang"
								aria-label="Sinkronkan sekarang"
								disabled={sync}
								onClick={() => {
									void overview.refetch();
									void transactions.refetch();
									if (scope.source !== "device") void gateways.refetch();
								}}
							>
								<RefreshCw size={16} className={sync ? "em-spin" : ""} />
							</button>
						</div>
					</div>
					<div className="em-sync-line">
						<span>
							<i
								className={`em-dot ${overview.isError ? "orange" : "green"}`}
							/>
							{overview.isError
								? "Sinkronisasi gagal"
								: data
									? `Diperbarui ${timestamp(data.generated_at)} WIB`
									: "Menunggu data Yukauto"}
						</span>
						<button
							type="button"
							role="switch"
							aria-checked={automatic}
							onClick={() => setAutomatic(!automatic)}
						>
							<span className={`em-switch ${automatic ? "on" : ""}`}>
								<i />
							</span>
							Auto-refresh 30 detik
						</button>
					</div>
					{overview.isError ? (
						<div className="em-error-banner" role="alert">
							<Activity size={19} />
							<div>
								<strong>Data Yukauto belum dapat diambil</strong>
								<p>
									Pastikan API Yukauto terhubung dan endpoint monitoring EMCee
									sudah tersedia. Angka tidak diganti dengan data contoh.
									{data
										? " Data yang terlihat adalah snapshot sinkronisasi terakhir."
										: ""}
								</p>
							</div>
							<button
								type="button"
								className="em-button small"
								onClick={() => void overview.refetch()}
							>
								Coba lagi
							</button>
						</div>
					) : null}
					<div className="em-metrics">
						<Metric
							label="Total uang masuk"
							value={summary ? rupiah(summary.incoming) : "—"}
							icon={ArrowDownLeft}
							tone="green"
							foot="Nominal pokok · berhasil"
							points={data?.chart.map((p) => p.incoming) ?? []}
						/>
						<Metric
							label="Total uang keluar"
							value={summary ? rupiah(summary.outgoing) : "—"}
							icon={ArrowUpRight}
							tone="orange"
							foot="Nominal pokok · berhasil"
							points={data?.chart.map((p) => p.outgoing) ?? []}
						/>
						<Metric
							label="Arus uang bersih"
							value={
								summary ? rupiah(summary.incoming - summary.outgoing) : "—"
							}
							icon={Wallet}
							tone="blue"
							foot="Uang masuk − uang keluar"
							points={data?.chart.map((p) => p.incoming - p.outgoing) ?? []}
						/>
						<Metric
							label="Keberhasilan transaksi"
							value={summary ? `${successRate}%` : "—"}
							icon={CheckCheck}
							tone="neutral"
							foot={
								summary
									? `${number(summary.success_count)} dari ${number(summary.total_count)} transaksi`
									: "Menunggu data transaksi"
							}
							points={[]}
						/>
					</div>
					{tab === "overview" ? (
						<>
							<div className="em-chart-grid">
								<CashflowChart data={data?.chart ?? []} />
								<ChannelComposition data={data} />
							</div>
							<div className="em-lower-grid">
								<section className="em-card em-tenant-card">
									<div className="em-card-heading">
										<div>
											<h2>Aktivitas per tenant</h2>
											<p>Urutan berdasarkan volume transaksi berhasil</p>
										</div>
										<Building2 size={18} className="em-muted" />
									</div>
									<div className="em-tenant-list">
										{data?.tenants.length ? (
											data.tenants.slice(0, 5).map((tenant, i) => {
												const max = Math.max(
													...data.tenants.map((t) => t.incoming + t.outgoing),
													1,
												);
												return (
													<button
														type="button"
														key={tenant.tenant_id}
														onClick={() =>
															changeScope({ tenant_id: tenant.tenant_id })
														}
													>
														<span
															className="em-tenant-initial"
															style={{
																background: `${palette[i % palette.length]}20`,
																color: palette[i % palette.length],
															}}
														>
															{tenant.tenant_name.slice(0, 1)}
														</span>
														<span className="em-tenant-progress">
															<strong>{tenant.tenant_name}</strong>
															<span>
																<i
																	style={{
																		width: `${((tenant.incoming + tenant.outgoing) / max) * 100}%`,
																		background: palette[i % palette.length],
																	}}
																/>
															</span>
														</span>
														<span className="em-tenant-total">
															<strong>
																Rp {compact(tenant.incoming + tenant.outgoing)}
															</strong>
															<small>
																{number(tenant.total_count)} transaksi
															</small>
														</span>
														<ChevronDown size={14} />
													</button>
												);
											})
										) : (
											<div className="em-empty">
												Belum ada aktivitas tenant.
											</div>
										)}
									</div>
								</section>
								<section
									className="em-card em-operation-card"
									id="em-attention"
								>
									<div className="em-card-heading">
										<div>
											<h2>Status operasional</h2>
											<p>Hal yang perlu Anda ketahui</p>
										</div>
										<span
											className={`em-status ${overview.isSuccess && !overview.isError ? "success" : "pending"}`}
										>
											<i />
											{overview.isError
												? "Perlu koneksi"
												: overview.isSuccess
													? "Monitor aktif"
													: "Menghubungkan"}
										</span>
									</div>
									<div className="em-operation-list">
										<button
											type="button"
											onClick={() => {
												setFilters({
													...filters,
													status: "pending",
													offset: 0,
												});
												setTab("transactions");
											}}
										>
											<span className="em-operation-icon orange">
												<Activity size={17} />
											</span>
											<div>
												<strong>Transaksi dalam proses</strong>
												<small>Belum masuk perhitungan arus uang</small>
											</div>
											<b>{summary ? number(summary.pending_count) : "—"}</b>
											<ArrowUpRight size={15} />
										</button>
										<button type="button" onClick={() => selectTab("devices")}>
											<span className="em-operation-icon green">
												<Smartphone size={17} />
											</span>
											<div>
												<strong>Device terhubung</strong>
												<small>
													{data
														? `${offline} device offline / tidak aktif`
														: "Menunggu status device"}
												</small>
											</div>
											<b>{data ? `${online}/${data.devices.length}` : "—"}</b>
											<ArrowUpRight size={15} />
										</button>
										<button
											type="button"
											onClick={() => {
												setFilters({ ...filters, status: "failed", offset: 0 });
												setTab("transactions");
											}}
										>
											<span className="em-operation-icon red">
												<ShieldCheck size={17} />
											</span>
											<div>
												<strong>Transaksi gagal / batal</strong>
												<small>Tidak dihitung sebagai uang keluar</small>
											</div>
											<b>{summary ? number(summary.failed_count) : "—"}</b>
											<ArrowUpRight size={15} />
										</button>
									</div>
								</section>
							</div>
						</>
					) : null}
					{tab === "gateway" ? (
						<>
							<div className="em-section-title">
								<div>
									<h2>Likuiditas Payment Gateway</h2>
									<p>
										Snapshot terkini · saldo merchant dan wallet tenant
										ditampilkan terpisah.
									</p>
								</div>
								<span className="em-tag">Refresh 60 detik</span>
							</div>
							{scope.source === "device" ? (
								<div className="em-error-banner">
									Pilih channel Payment Gateway untuk melihat saldo PG.
								</div>
							) : gateways.isError ? (
								<div className="em-error-banner" role="alert">
									Saldo PG belum tersedia. Periksa koneksi provider dan izin
									master:tenant_management.
								</div>
							) : (
								<div className="em-provider-grid">
									{gateways.data?.providers.map((provider) => (
										<article
											className="em-card em-provider"
											key={`${provider.provider}-${provider.profile_id ?? "platform"}`}
										>
											<div>
												<span className="em-provider-logo">
													{provider.provider.slice(0, 1).toUpperCase()}
												</span>
												<strong>{provider.provider.toUpperCase()}</strong>
												<span
													className={`em-status ${provider.live ? "success" : "pending"}`}
												>
													<i />
													{provider.live ? "Tersedia" : "Tidak tersedia"}
												</span>
											</div>
											<p>Saldo merchant PG</p>
											<h3>
												{provider.real_balance === null
													? "Tidak tersedia"
													: rupiah(provider.real_balance)}
											</h3>
											<small>
												{provider.merchant_name} · {provider.merchant_id}
											</small>
											<footer>
												<span>Dana pending</span>
												<strong>
													{provider.pending_balance === null
														? "—"
														: rupiah(provider.pending_balance)}
												</strong>
											</footer>
										</article>
									))}
									{gateways.isLoading ? (
										<div className="em-card em-empty">
											Mengambil saldo merchant PG...
										</div>
									) : !gateways.data?.providers.length ? (
										<div className="em-card em-empty">
											Belum ada merchant PG pada scope ini.
										</div>
									) : null}
								</div>
							)}
							<div className="em-finance-strip">
								<div>
									<span>Wallet tenant saat ini</span>
									<strong>{data ? rupiah(data.wallet_balance) : "—"}</strong>
								</div>
								<div>
									<span>Biaya admin · periode</span>
									<strong>{summary ? rupiah(summary.admin_fee) : "—"}</strong>
								</div>
								<div>
									<span>Margin PG terkonfirmasi · periode</span>
									<strong>{summary ? rupiah(summary.margin) : "—"}</strong>
								</div>
								<div>
									<span>Biaya provider belum final</span>
									<strong>
										{summary
											? `${number(summary.unsettled_fee_count)} transaksi`
											: "—"}
									</strong>
								</div>
							</div>
							<section className="em-card">
								<div className="em-card-heading">
									<div>
										<h2>Wallet per tenant</h2>
										<p>
											Riwayat pendanaan dan penarikan kumulatif sejak pencatatan
											wallet.
										</p>
									</div>
									<Wallet size={18} />
								</div>
								<div className="em-table-scroll">
									<table>
										<thead>
											<tr>
												<th>TENANT</th>
												<th>PROVIDER</th>
												<th className="right">SALDO WALLET</th>
												<th className="right">DANA DIRESERVASI</th>
												<th className="right">TOTAL TOP UP</th>
												<th className="right">TOTAL PENARIKAN</th>
											</tr>
										</thead>
										<tbody>
											{scope.source !== "device" &&
												gateways.data?.tenants.map((t) => (
													<tr key={t.tenant_id}>
														<td>
															<strong>{t.tenant_name}</strong>
														</td>
														<td>{t.effective_provider.toUpperCase()}</td>
														<td className="right">{rupiah(t.balance)}</td>
														<td className="right">{rupiah(t.reserved)}</td>
														<td className="right">{rupiah(t.total_topup)}</td>
														<td className="right">
															{rupiah(t.total_withdraw)}
														</td>
													</tr>
												))}
										</tbody>
									</table>
								</div>
							</section>
						</>
					) : null}
					{tab === "devices" ? (
						<>
							<div className="em-finance-strip">
								<div>
									<span>Saldo rekening tercatat</span>
									<strong>{data ? rupiah(bankBalance) : "—"}</strong>
								</div>
								<div>
									<span>Rekening aktif</span>
									<strong>{data ? number(data.banks.length) : "—"}</strong>
								</div>
								<div>
									<span>Device online</span>
									<strong>
										{data ? `${online} / ${data.devices.length}` : "—"}
									</strong>
								</div>
								<div>
									<span>Saldo perlu diperbarui (&gt;15 mnt)</span>
									<strong>
										{data
											? number(data.banks.filter((b) => b.stale).length)
											: "—"}
									</strong>
								</div>
							</div>
							<section className="em-card">
								<div className="em-card-heading">
									<div>
										<h2>Saldo rekening bank</h2>
										<p>
											Saldo terakhir yang dilaporkan device, bukan saldo
											real-time bank.
										</p>
									</div>
									<Wallet size={18} />
								</div>
								<div className="em-table-scroll">
									<table>
										<thead>
											<tr>
												<th>BANK / REKENING</th>
												<th>TENANT</th>
												<th>DEVICE</th>
												<th className="right">SALDO TERCATAT</th>
												<th>PEMBARUAN TERAKHIR · WIB</th>
												<th>STATUS SALDO</th>
											</tr>
										</thead>
										<tbody>
											{data?.banks.map((bank) => (
												<tr key={bank.id}>
													<td>
														<strong>{bank.bank}</strong>
														<small>
															{bank.account_number_masked ??
																"Nomor belum tersedia"}
														</small>
													</td>
													<td>{bank.tenant_name}</td>
													<td>{bank.device_name ?? "—"}</td>
													<td className="right">
														{bank.balance === null
															? "Belum tersedia"
															: rupiah(bank.balance)}
													</td>
													<td>{timestamp(bank.last_balance_update)}</td>
													<td>
														<span
															className={`em-status ${bank.stale ? "pending" : "success"}`}
														>
															<i />
															{bank.stale ? "Perlu pembaruan" : "Terkini"}
														</span>
													</td>
												</tr>
											))}
											{!data?.banks.length ? (
												<tr>
													<td colSpan={6} className="em-empty">
														Belum ada rekening pada scope ini.
													</td>
												</tr>
											) : null}
										</tbody>
									</table>
								</div>
							</section>
							<div className="em-section-title">
								<div>
									<h2>Device fleet</h2>
									<p>
										Online jika berstatus aktif dan heartbeat diterima dalam 5
										menit terakhir.
									</p>
								</div>
								<span className="em-tag">{online} online</span>
							</div>
							<div className="em-device-grid">
								{data?.devices.map((device) => (
									<article className="em-card em-device" key={device.id}>
										<div>
											<span className="em-operation-icon green">
												<Smartphone size={20} />
											</span>
											<span
												className={`em-status ${device.online ? "success" : "pending"}`}
											>
												<i />
												{device.online ? "Online" : "Offline / nonaktif"}
											</span>
										</div>
										<h3>{device.device_name ?? "Device tanpa nama"}</h3>
										<p>{device.device_model ?? "Model belum tersedia"}</p>
										<footer>
											<span>{device.tenant_name}</span>
											<small>
												Terakhir: {timestamp(device.last_seen_at)} WIB
											</small>
										</footer>
									</article>
								))}
							</div>
						</>
					) : null}
					{tab !== "devices" ? (
						<TransactionTable
							data={transactions.data}
							loading={
								filters.search !== debouncedSearch ||
								(transactions.isFetching && !transactions.data)
							}
							error={transactions.isError}
							filters={filters}
							setFilters={setFilters}
							compact={tab === "overview"}
						/>
					) : null}
					{tab === "overview" ? (
						<div className="em-view-all">
							<button type="button" onClick={() => setTab("transactions")}>
								Jelajahi semua transaksi
								<ArrowRight size={15} />
							</button>
						</div>
					) : null}
					<footer className="em-footer">
						<span>
							<span className="em-footer-brand">EMCee</span> A clear view of
							your money.
						</span>
						<span>
							<ShieldCheck size={13} />
							Powered by Yukauto<span className="em-footer-separator">·</span>
							WIB (UTC+7)
						</span>
					</footer>
				</main>
			</div>
		</div>
	);
}
