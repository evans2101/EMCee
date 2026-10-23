"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
	ArrowDownLeft,
	ArrowUpRight,
	ChevronLeft,
	ChevronRight,
	Download,
	Search,
	X,
} from "lucide-react";
import { useState } from "react";
import { downloadCsv, number, rupiah, timestamp } from "@/lib/emcee/format";
import type {
	MonitorTransaction,
	TransactionFilters,
	TransactionPage,
} from "@/lib/emcee/types";

export function Status({
	row,
}: {
	row: Pick<MonitorTransaction, "successful" | "failed">;
}) {
	return (
		<span
			className={`em-status ${row.successful ? "success" : row.failed ? "failed" : "pending"}`}
		>
			<i />
			{row.successful
				? "Berhasil"
				: row.failed
					? "Gagal / batal"
					: "Dalam proses"}
		</span>
	);
}

export function TransactionTable({
	data,
	loading,
	error,
	filters,
	setFilters,
	compact = false,
}: {
	data?: TransactionPage;
	loading: boolean;
	error: boolean;
	filters: TransactionFilters;
	setFilters: (filters: TransactionFilters) => void;
	compact?: boolean;
}) {
	const [selected, setSelected] = useState<MonitorTransaction | null>(null);
	const rows = compact ? data?.rows.slice(0, 6) : data?.rows;
	const update = (patch: Partial<TransactionFilters>) =>
		setFilters({ ...filters, ...patch, offset: 0 });
	function exportPage() {
		if (!data) return;
		downloadCsv("EMCee-transaksi-halaman.csv", [
			[
				"ID",
				"Referensi",
				"Tenant",
				"Waktu WIB",
				"Arah",
				"Channel",
				"Provider",
				"Nama",
				"Bank",
				"Nominal IDR",
				"Admin IDR",
				"Status",
			],
			...(rows ?? []).map((r) => [
				r.id,
				r.external_ref ?? "",
				r.tenant_name,
				timestamp(r.created_at),
				r.direction,
				r.channel,
				r.provider ?? "",
				r.counterparty,
				r.bank,
				r.amount,
				r.fee,
				r.status,
			]),
		]);
	}
	return (
		<section className="em-card em-transactions" aria-label="Daftar transaksi">
			<div className="em-card-heading">
				<div>
					<h2>
						{compact ? "Transaksi terbaru" : "Semua transaksi"}{" "}
						<span className="em-count">{data ? number(data.total) : "—"}</span>
					</h2>
					<p>Arus uang PG dan bank device, dalam satu tempat.</p>
				</div>
				<button
					type="button"
					className="em-button small"
					onClick={exportPage}
					disabled={!rows?.length || error || loading}
				>
					<Download size={14} />
					Ekspor halaman
				</button>
			</div>
			<div className="em-table-filters">
				<label className="em-search">
					<Search size={16} />
					<input
						aria-label="Cari transaksi"
						placeholder="Cari referensi, tenant, atau nama..."
						value={filters.search}
						onChange={(e) => update({ search: e.target.value })}
					/>
					{filters.search ? (
						<button
							type="button"
							aria-label="Hapus pencarian"
							onClick={() => update({ search: "" })}
						>
							<X size={14} />
						</button>
					) : null}
				</label>
				<select
					aria-label="Filter status transaksi"
					value={filters.status}
					onChange={(e) =>
						update({ status: e.target.value as TransactionFilters["status"] })
					}
				>
					<option value="all">Semua status</option>
					<option value="success">Berhasil</option>
					<option value="pending">Dalam proses</option>
					<option value="failed">Gagal / batal</option>
				</select>
				<select
					aria-label="Filter arah transaksi"
					value={filters.direction}
					onChange={(e) =>
						update({
							direction: e.target.value as TransactionFilters["direction"],
						})
					}
				>
					<option value="all">Semua arus</option>
					<option value="incoming">Uang masuk</option>
					<option value="outgoing">Uang keluar</option>
				</select>
			</div>
			<div className="em-table-scroll" aria-busy={loading}>
				<table>
					<thead>
						<tr>
							<th>TRANSAKSI / REFERENSI</th>
							<th>TENANT</th>
							<th>CHANNEL</th>
							<th>WAKTU · WIB</th>
							<th className="right">NOMINAL</th>
							<th>STATUS</th>
							<th>
								<span className="em-sr-only">Detail</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{!loading &&
							!error &&
							rows?.map((row) => (
								<tr key={row.id}>
									<td>
										<div className="em-tx-name">
											<span className={`em-flow-icon ${row.direction}`}>
												{row.direction === "incoming" ? (
													<ArrowDownLeft size={17} />
												) : (
													<ArrowUpRight size={17} />
												)}
											</span>
											<div>
												<strong>{row.counterparty}</strong>
												<small>{row.external_ref ?? row.id.slice(0, 12)}</small>
											</div>
										</div>
									</td>
									<td>
										<span className="em-tenant-name">{row.tenant_name}</span>
										<small>{row.bank}</small>
									</td>
									<td>
										<span className={`em-channel-label ${row.channel}`}>
											{row.channel === "gateway"
												? "Payment Gateway"
												: "Bank Device"}
										</span>
										<small>
											{row.provider?.toUpperCase() ?? "Bank automation"}
										</small>
									</td>
									<td className="em-date-cell">{timestamp(row.created_at)}</td>
									<td className={`right em-amount ${row.direction}`}>
										{row.direction === "incoming" ? "+" : "−"}{" "}
										{rupiah(row.amount)}
									</td>
									<td>
										<Status row={row} />
									</td>
									<td>
										<button
											type="button"
											className="em-icon-button"
											aria-label={`Detail transaksi ${row.external_ref ?? row.id}`}
											onClick={() => setSelected(row)}
										>
											<ArrowUpRight size={16} />
										</button>
									</td>
								</tr>
							))}
						{loading || error || !rows?.length ? (
							<tr>
								<td colSpan={7}>
									<div className="em-empty">
										{loading
											? "Mengambil transaksi Yukauto..."
											: error
												? "Transaksi belum dapat dimuat. Coba sinkronkan kembali."
												: "Tidak ada transaksi yang sesuai filter."}
									</div>
								</td>
							</tr>
						) : null}
					</tbody>
				</table>
			</div>
			<div className="em-table-footer">
				<span>
					{data && !error
						? `${data.total ? data.offset + 1 : 0}–${Math.min(data.offset + (rows?.length ?? 0), data.total)} dari ${number(data.total)} transaksi`
						: "Data transaksi Yukauto"}
				</span>
				{!compact ? (
					<div className="em-pagination">
						<button
							type="button"
							className="em-icon-button"
							aria-label="Halaman sebelumnya"
							disabled={loading || filters.offset === 0}
							onClick={() =>
								setFilters({
									...filters,
									offset: Math.max(0, filters.offset - 20),
								})
							}
						>
							<ChevronLeft size={16} />
						</button>
						<span>
							{Math.floor(filters.offset / 20) + 1} /{" "}
							{Math.max(1, Math.ceil((data?.total ?? 0) / 20))}
						</span>
						<button
							type="button"
							className="em-icon-button"
							aria-label="Halaman selanjutnya"
							disabled={loading || !data || filters.offset + 20 >= data.total}
							onClick={() =>
								setFilters({ ...filters, offset: filters.offset + 20 })
							}
						>
							<ChevronRight size={16} />
						</button>
					</div>
				) : (
					<span className="em-muted">
						6 transaksi paling baru sesuai filter
					</span>
				)}
			</div>
			<Dialog.Root
				open={!!selected}
				onOpenChange={(open) => {
					if (!open) setSelected(null);
				}}
			>
				<Dialog.Portal>
					<Dialog.Overlay className="em-dialog-overlay" />
					<Dialog.Content className="emcee-root em-dialog">
						<Dialog.Title>Detail transaksi</Dialog.Title>
						<Dialog.Description>
							Informasi transaksi dari Yukauto. Seluruh nilai dalam rupiah.
						</Dialog.Description>
						<Dialog.Close
							className="em-icon-button em-dialog-close"
							aria-label="Tutup detail"
						>
							<X size={20} />
						</Dialog.Close>
						{selected ? (
							<>
								<div className={`em-detail-amount ${selected.direction}`}>
									{selected.direction === "incoming" ? "+" : "−"}{" "}
									{rupiah(selected.amount)}
								</div>
								<Status row={selected} />
								<dl className="em-detail-list">
									{[
										["ID", selected.id],
										["Referensi", selected.external_ref ?? "—"],
										["Tenant", selected.tenant_name],
										["Nama", selected.counterparty],
										["Bank / tujuan", selected.bank],
										[
											"Channel",
											selected.channel === "gateway"
												? `PG · ${selected.provider ?? "—"}`
												: "Bank Device",
										],
										[
											"Waktu pencatatan",
											`${timestamp(selected.created_at)} WIB`,
										],
										["Status Yukauto", selected.status],
										["Biaya admin", rupiah(selected.fee)],
										[
											"Biaya provider",
											selected.provider_fee === null
												? "Belum tersedia / tidak berlaku"
												: rupiah(selected.provider_fee),
										],
										["Device ID", selected.device_id ?? "—"],
									].map(([label, value]) => (
										<div key={label}>
											<dt>{label}</dt>
											<dd>{value}</dd>
										</div>
									))}
								</dl>
							</>
						) : null}
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</section>
	);
}
