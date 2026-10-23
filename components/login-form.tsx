"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
	ArrowRight,
	Eye,
	EyeOff,
	LoaderCircle,
	LockKeyhole,
	ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/auth-context";
import { hasMasterAccess } from "@/lib/auth";

export function LoginForm({ siteKey }: { siteKey: string }) {
	const { currentUser, isAuthLoading, authError, login, logout } = useAuth();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [remember, setRemember] = useState(false);
	const [visible, setVisible] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [captcha, setCaptcha] = useState("");
	const turnstile = useRef<TurnstileInstance>(null);
	useEffect(() => {
		if (!isAuthLoading && hasMasterAccess(currentUser)) router.replace("/");
	}, [currentUser, isAuthLoading, router]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy) return;
		setBusy(true);
		setError("");
		try {
			await login({
				email,
				password,
				remember_me: remember,
				...(captcha ? { turnstile_token: captcha } : {}),
			});
			setPassword("");
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Tidak dapat masuk. Silakan coba lagi.",
			);
			turnstile.current?.reset();
			setCaptcha("");
		} finally {
			setBusy(false);
		}
	}
	return (
		<main className="em-login">
			<section className="em-login-story">
				<Link href="/preview" className="em-brand">
					<span className="em-brand-mark">
						e<span>↗</span>
					</span>
					<span>
						EMCee<small>EXECUTIVE MONITOR</small>
					</span>
				</Link>
				<div>
					<span className="em-login-eyebrow">YUKAUTO INTELLIGENCE</span>
					<h1>
						Clarity in
						<br />
						every flow<span>.</span>
					</h1>
					<p>
						Setiap pergerakan uang Yukauto.
						<br />
						Satu pandangan untuk keputusan yang lebih jelas.
					</p>
					<div className="em-login-features">
						<span>
							<ShieldCheck size={17} />
							Akses khusus master Yukauto
						</span>
						<span>
							<LockKeyhole size={17} />
							Sesi aman dengan cookie HttpOnly
						</span>
					</div>
				</div>
				<footer>EMCee · A clear view of your money.</footer>
			</section>
			<section className="em-login-panel">
				<div className="em-login-form">
					<span className="em-eyebrow">EXECUTIVE WORKSPACE</span>
					<h2>Selamat datang kembali.</h2>
					<p>Masuk menggunakan akun master Yukauto Anda.</p>
					{currentUser && !hasMasterAccess(currentUser) ? (
						<div className="em-error-banner">
							Akun ini belum memiliki akses master.{" "}
							<button
								type="button"
								className="em-button small"
								onClick={() => void logout()}
							>
								Keluar
							</button>
						</div>
					) : null}
					<form onSubmit={submit}>
						<label>
							Email
							<input
								type="email"
								autoComplete="username"
								required
								maxLength={254}
								placeholder="nama@perusahaan.com"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								disabled={busy}
							/>
						</label>
						<label>
							Kata sandi
							<span className="em-password">
								<input
									type={visible ? "text" : "password"}
									autoComplete="current-password"
									required
									maxLength={1024}
									placeholder="Masukkan kata sandi"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									disabled={busy}
								/>
								<button
									type="button"
									aria-label={
										visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
									}
									onClick={() => setVisible(!visible)}
								>
									{visible ? <EyeOff size={17} /> : <Eye size={17} />}
								</button>
							</span>
						</label>
						<label className="em-remember">
							<input
								type="checkbox"
								checked={remember}
								onChange={(event) => setRemember(event.target.checked)}
							/>
							Ingat saya selama 7 hari
						</label>
						{siteKey ? (
							<Turnstile
								ref={turnstile}
								siteKey={siteKey}
								onSuccess={setCaptcha}
								onExpire={() => setCaptcha("")}
								onError={() => {
									setCaptcha("");
									setError("Verifikasi CAPTCHA gagal. Silakan coba kembali.");
								}}
								options={{ theme: "light" }}
							/>
						) : null}
						{error || authError ? (
							<p className="em-login-error" role="alert">
								{error || authError}
							</p>
						) : null}
						<button
							type="submit"
							className="em-button primary"
							disabled={busy || (Boolean(siteKey) && !captcha)}
						>
							{busy ? <LoaderCircle size={16} className="em-spin" /> : null}
							{busy ? "Memverifikasi akun..." : "Masuk ke EMCee"}
							{!busy ? <ArrowRight size={16} /> : null}
						</button>
					</form>
					<div className="em-login-preview">
						Ingin melihat tampilannya?
						<Link href="/preview">
							Jelajahi preview
							<ArrowRight size={13} />
						</Link>
					</div>
					<p className="em-login-note">
						EMCee hanya membaca data keuangan. Login dan pembaruan sesi
						menggunakan autentikasi Yukauto.
					</p>
				</div>
			</section>
		</main>
	);
}
