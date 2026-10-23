"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { authenticatedGet, authPost } from "@/lib/api/client";
import type { CurrentUser, LoginRequest } from "@/lib/types/auth";

interface AuthContextValue {
	currentUser: CurrentUser | null;
	isAuthLoading: boolean;
	authError: string | null;
	login: (request: LoginRequest) => Promise<void>;
	logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [currentUser, setUser] = useState<CurrentUser | null>(null);
	const [isAuthLoading, setLoading] = useState(true);
	const [authError, setError] = useState<string | null>(null);
	const generation = useRef(0);

	useEffect(() => {
		if (pathname === "/preview") {
			setLoading(false);
			return;
		}
		const controller = new AbortController();
		const current = ++generation.current;
		setLoading(true);
		authenticatedGet<CurrentUser | null>(
			"/api/auth/session",
			controller.signal,
			false,
		)
			.then((user) => {
				if (generation.current === current) {
					setUser(user);
					setError(null);
				}
			})
			.catch((error) => {
				if (!controller.signal.aborted && generation.current === current) {
					setUser(null);
					setError(
						error instanceof Error ? error.message : "Sesi tidak tersedia.",
					);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted && generation.current === current)
					setLoading(false);
			});
		return () => controller.abort();
	}, [pathname]);

	async function login(request: LoginRequest) {
		const user = await authPost<CurrentUser>("login", request);
		generation.current += 1;
		queryClient.clear();
		setUser(user);
		setLoading(false);
		setError(null);
		router.replace("/");
	}
	async function logout() {
		await authPost("logout");
		generation.current += 1;
		queryClient.clear();
		setUser(null);
		setLoading(false);
		setError(null);
		router.replace("/login");
	}
	return (
		<AuthContext.Provider
			value={{ currentUser, isAuthLoading, authError, login, logout }}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const value = useContext(AuthContext);
	if (!value) throw new Error("AuthProvider tidak tersedia.");
	return value;
}
