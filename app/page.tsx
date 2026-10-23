import { EmceeDashboard } from "@/components/emcee/dashboard";

export default function HomePage() {
	let yukautoUrl: string | undefined;
	try {
		const url = new URL(process.env.YUKAUTO_WEB_URL ?? "");
		if (["http:", "https:"].includes(url.protocol)) yukautoUrl = url.toString();
	} catch {
		/* The link is optional. */
	}
	return <EmceeDashboard yukautoUrl={yukautoUrl} />;
}
