import type { CurrentUser } from "@/lib/types/auth";

// Match Yukauto's has_master_access middleware, including custom master roles.
export function hasMasterAccess(user: CurrentUser | null): boolean {
	return !!user?.permissions.some((permission) =>
		permission.startsWith("master:"),
	);
}
