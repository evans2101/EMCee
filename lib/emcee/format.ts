export const rupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);
export const number = (value: number) =>
	new Intl.NumberFormat("id-ID").format(value);
export function compact(value: number) {
	const abs = Math.abs(value);
	const [unit, suffix] =
		abs >= 1e12
			? [1e12, "T"]
			: abs >= 1e9
				? [1e9, "M"]
				: abs >= 1e6
					? [1e6, "jt"]
					: abs >= 1e3
						? [1e3, "rb"]
						: [1, ""];
	return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value / unit)}${suffix ? ` ${suffix}` : ""}`;
}
export const wibDate = (date: Date) =>
	new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Jakarta",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
export function periodDates(days = 30) {
	const to = wibDate(new Date());
	const start = new Date(`${to}T00:00:00+07:00`);
	start.setUTCDate(start.getUTCDate() - days + 1);
	return { from_date: wibDate(start), to_date: to };
}
export const timestamp = (value: string | null) =>
	value
		? new Intl.DateTimeFormat("id-ID", {
				timeZone: "Asia/Jakarta",
				day: "2-digit",
				month: "short",
				hour: "2-digit",
				minute: "2-digit",
			}).format(new Date(value))
		: "Belum tersedia";
export const dateLabel = (value: string) =>
	new Intl.DateTimeFormat("id-ID", {
		day: "numeric",
		month: "short",
		timeZone: "Asia/Jakarta",
	}).format(new Date(`${value}T12:00:00+07:00`));

export function downloadCsv(filename: string, rows: (string | number)[][]) {
	const csv = rows
		.map((row) =>
			row
				.map((value) => {
					// Spreadsheet formula injection protection applies to text, not signed amounts.
					const text =
						typeof value === "string" && /^[=+\-@\t\r]/.test(value)
							? `'${value}`
							: String(value);
					return `"${text.replaceAll('"', '""')}"`;
				})
				.join(","),
		)
		.join("\r\n");
	const url = URL.createObjectURL(
		new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
