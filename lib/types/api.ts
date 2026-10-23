// Generic API response envelope — every backend endpoint returns this shape
export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: ApiError;
	meta?: PaginationMeta;
}

export interface ApiError {
	code: string;
	message: string;
}

export interface PaginationMeta {
	page: number;
	per_page: number;
	total: number;
	total_pages: number;
}

// Generic query params for list endpoints
export interface PaginationParams {
	page?: number;
	per_page?: number;
	sort?: string;
	order?: "asc" | "desc";
}

export interface DateRangeParams {
	from?: string; // ISO 8601
	to?: string; // ISO 8601
}
