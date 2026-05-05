/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
// @ts-expect-error
const { PrismaPlugin } = require("@prisma/nextjs-monorepo-workaround-plugin");

/** @type {import("next").NextConfig} */
const config = {
	experimental: {
		authInterrupts: true,
		optimizePackageImports: [],
	},
	output: "standalone",
	outputFileTracingIncludes: {
		"/**": [
			"./node_modules/.prisma/client/*.js",
			"./node_modules/.prisma/client/*.node",
		],
	},
	webpack: (config, { isServer }) => {
		if (isServer) {
			config.plugins = [...config.plugins, new PrismaPlugin()];
		}

		return config;
	},
};

export default config;
