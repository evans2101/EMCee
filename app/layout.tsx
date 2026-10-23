import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const metadata: Metadata = {
	title: "EMCee — Yukauto Executive Monitor",
	description:
		"Satu pandangan untuk arus uang, payment gateway, dan device Yukauto.",
	robots: { index: false, follow: false },
	icons: { icon: "/emcee-mark.svg" },
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="id">
			<body className={inter.variable}>
				<div className="emcee-root">
					<Providers>{children}</Providers>
				</div>
			</body>
		</html>
	);
}
