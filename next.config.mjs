const development = process.env.NODE_ENV === "development";
const policy = [
	"default-src 'self'",
	`script-src 'self' 'unsafe-inline' ${development ? "'unsafe-eval' " : ""}https://challenges.cloudflare.com`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob:",
	`connect-src 'self' https://challenges.cloudflare.com${development ? " ws://127.0.0.1:* ws://localhost:*" : ""}`,
	"frame-src https://challenges.cloudflare.com",
	"frame-ancestors 'none'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
].join("; ");

export default {
	output: "standalone",
	poweredByHeader: false,
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{ key: "Content-Security-Policy", value: policy },
					{ key: "X-Frame-Options", value: "DENY" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "same-origin" },
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=()",
					},
				],
			},
		];
	},
};
