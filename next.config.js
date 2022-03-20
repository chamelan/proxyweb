/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	trailingSlash: true,
	enabledTransports: ["ws", "wss"],
	webpack(config) {
		config.module.rules.push({
			test: /\.svg$/,
			use: ["@svgr/webpack"],
		})

		return config
	},
	async headers() {
		return [
			{
				source: "/api/proxy",
				headers: [
					{
						key: "Access-Control-Allow-Origin",
						value: "*",
					},
				],
			},
		]
	},
}

module.exports = nextConfig
