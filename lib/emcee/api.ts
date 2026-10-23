import { getApiData } from "@/lib/api/client";
import type {
	FinanceOverview,
	FinanceScope,
	TransactionFilters,
	TransactionPage,
} from "./types";

function scopeParams(scope: FinanceScope) {
	return {
		from_date: scope.from_date,
		to_date: scope.to_date,
		source: scope.source,
		...(scope.tenant_id ? { tenant_id: scope.tenant_id } : {}),
	};
}

export const emceeApi = {
	overview: (scope: FinanceScope, signal?: AbortSignal) =>
		getApiData<FinanceOverview>(
			"master/monitoring/finance",
			scopeParams(scope),
			signal,
		),
	transactions: (
		scope: FinanceScope,
		filters: TransactionFilters,
		signal?: AbortSignal,
	) =>
		getApiData<TransactionPage>(
			"master/monitoring/finance/transactions",
			{ ...scopeParams(scope), ...filters, limit: 20 },
			signal,
		),
};
