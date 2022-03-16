/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	trailingSlash: true,
	enabledTransports: ["ws", "wss"],
}

module.exports = nextConfig
