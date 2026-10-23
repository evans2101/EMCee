"use client";

import { useId, useState } from "react";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { compact, dateLabel, rupiah } from "@/lib/emcee/format";
import type { FlowPoint } from "@/lib/emcee/types";

export default function CashflowChart({ data }: { data: FlowPoint[] }) {
	const [cumulative, setCumulative] = useState(false);
	const gradientId = useId().replaceAll(":", "");
	let incoming = 0;
	let outgoing = 0;
	const points = cumulative
		? data.map((point) => {
				incoming += point.incoming;
				outgoing += point.outgoing;
				return { ...point, incoming, outgoing };
			})
		: data;
	return (
		<section className="em-card em-chart-card" aria-label="Grafik arus uang">
			<div className="em-card-heading">
				<div>
					<h2>Arus uang</h2>
					<p>Pergerakan dana masuk dan keluar</p>
				</div>
				<div
					className="em-chart-toggle"
					role="group"
					aria-label="Tampilan grafik"
				>
					<button
						type="button"
						aria-pressed={!cumulative}
						className={!cumulative ? "active" : ""}
						onClick={() => setCumulative(false)}
					>
						Harian
					</button>
					<button
						type="button"
						aria-pressed={cumulative}
						className={cumulative ? "active" : ""}
						onClick={() => setCumulative(true)}
					>
						Kumulatif
					</button>
				</div>
			</div>
			<div className="em-chart-legend">
				<span>
					<i className="em-dot green" />
					Uang masuk
				</span>
				<span>
					<i className="em-dot orange" />
					Uang keluar
				</span>
				<small>IDR</small>
			</div>
			<div
				className="em-chart"
				role="img"
				aria-label={`Grafik ${cumulative ? "kumulatif" : "harian"} uang masuk dan keluar selama ${data.length} hari`}
			>
				{data.length ? (
					<ResponsiveContainer width="100%" height="100%" minWidth={0}>
						<ComposedChart
							data={points}
							margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
						>
							<defs>
								<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor="#348b69" stopOpacity={0.17} />
									<stop offset="100%" stopColor="#348b69" stopOpacity={0.005} />
								</linearGradient>
							</defs>
							<CartesianGrid
								stroke="#edf0ed"
								strokeDasharray="4 5"
								vertical={false}
							/>
							<XAxis
								dataKey="date"
								tickFormatter={dateLabel}
								tick={{ fill: "#87918d", fontSize: 11 }}
								axisLine={false}
								tickLine={false}
								minTickGap={45}
								dy={10}
							/>
							<YAxis
								tickFormatter={compact}
								tick={{ fill: "#87918d", fontSize: 11 }}
								axisLine={false}
								tickLine={false}
								width={57}
								tickCount={5}
							/>
							<Tooltip
								labelFormatter={(label) => dateLabel(String(label))}
								formatter={(value, name) => [
									rupiah(Number(value)),
									name === "incoming" ? "Uang masuk" : "Uang keluar",
								]}
								contentStyle={{
									border: "1px solid #e6ebe7",
									borderRadius: 12,
									fontSize: 12,
									boxShadow: "0 8px 30px #132b1812",
								}}
							/>
							<Area
								type="monotone"
								dataKey="incoming"
								stroke="#318563"
								strokeWidth={2.5}
								fill={`url(#${gradientId})`}
								isAnimationActive={false}
							/>
							<Line
								type="monotone"
								dataKey="outgoing"
								stroke="#d49a66"
								strokeWidth={2.3}
								dot={false}
								activeDot={{ r: 4 }}
								isAnimationActive={false}
							/>
						</ComposedChart>
					</ResponsiveContainer>
				) : (
					<div className="em-empty">
						Grafik akan tampil setelah data tersedia.
					</div>
				)}
			</div>
			<div className="em-chart-foot">
				<span>
					<i className="em-dot green" />
					Hanya transaksi berhasil
				</span>
				<span>Waktu pencatatan · WIB</span>
			</div>
		</section>
	);
}
