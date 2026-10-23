import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
	return (
		<LoginForm
			siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ""}
		/>
	);
}
