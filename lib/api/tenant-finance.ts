import { getApiData } from "./client";

export interface TenantFinance {
	tenant_id: string;
	tenant_name: string;
	balance: number;
	withdrawal_fee: number;
	total_topup: number;
	total_withdraw: number;
	total_admin_fee: number;
	total_revenue: number;
	unsettled_fee_count: number;
	reserved: number;
	effective_provider: string;
	apkita_profile_id: string | null;
}
export interface ProviderBalance {
	provider: string;
	profile_id: string | null;
	merchant_id: string;
	merchant_name: string;
	real_balance: number | null;
	pending_balance: number | null;
	live: boolean;
}
export interface FinanceOverview {
	tenants: TenantFinance[];
	providers: ProviderBalance[];
}

export const tenantFinanceApi = {
	overview: (tenantId?: string) =>
		getApiData<FinanceOverview>(
			"master/tenants/financial-overview",
			tenantId ? { tenant_id: tenantId } : {},
		),
};
