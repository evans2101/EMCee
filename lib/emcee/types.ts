export interface FinanceScope {
	from_date: string;
	to_date: string;
	source: "all" | "device" | "gateway";
	tenant_id: string;
}
export interface CashSummary {
	incoming: number;
	outgoing: number;
	total_count: number;
	success_count: number;
	pending_count: number;
	failed_count: number;
	admin_fee: number;
	margin: number;
	unsettled_fee_count: number;
}
export interface FlowPoint {
	date: string;
	incoming: number;
	outgoing: number;
}
export interface ChannelFlow {
	channel: string;
	provider: string | null;
	incoming: number;
	outgoing: number;
	total_count: number;
	success_count: number;
	pending_count: number;
	failed_count: number;
}
export interface TenantFlow {
	tenant_id: string;
	tenant_name: string;
	incoming: number;
	outgoing: number;
	total_count: number;
	pending_count: number;
}
export interface MonitorDevice {
	id: string;
	tenant_id: string;
	tenant_name: string;
	device_name: string | null;
	device_model: string | null;
	status: string;
	last_seen_at: string | null;
	online: boolean;
}
export interface MonitorBank {
	id: string;
	tenant_id: string;
	tenant_name: string;
	bank: string;
	account_number_masked: string | null;
	account_name: string | null;
	balance: number | null;
	last_balance_update: string | null;
	device_id: string;
	device_name: string | null;
	stale: boolean;
}
export interface FinanceOverview {
	summary: CashSummary;
	chart: FlowPoint[];
	channels: ChannelFlow[];
	tenants: TenantFlow[];
	tenant_options: { id: string; name: string }[];
	banks: MonitorBank[];
	devices: MonitorDevice[];
	wallet_balance: number;
	generated_at: string;
	timezone: string;
}
export interface MonitorTransaction {
	id: string;
	tenant_id: string;
	tenant_name: string;
	external_ref: string | null;
	direction: "incoming" | "outgoing";
	channel: string;
	provider: string | null;
	bank: string;
	counterparty: string;
	amount: number;
	fee: number;
	provider_fee: number | null;
	status: string;
	successful: boolean;
	failed: boolean;
	device_id: string | null;
	created_at: string;
}
export interface TransactionPage {
	rows: MonitorTransaction[];
	total: number;
	limit: number;
	offset: number;
}
export interface TransactionFilters {
	search: string;
	status: "all" | "success" | "pending" | "failed";
	direction: "all" | "incoming" | "outgoing";
	offset: number;
}
