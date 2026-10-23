export interface CurrentUser {
	id: string;
	name: string;
	email: string;
	tenant_id: string | null;
	roles: string[];
	permissions: string[];
}
export interface LoginRequest {
	email: string;
	password: string;
	remember_me: boolean;
	turnstile_token?: string;
}
export interface TokenResponse {
	access_token: string;
	refresh_token: string;
	user: Omit<CurrentUser, "permissions">;
	permissions: string[];
}
