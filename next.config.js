/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

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
};

export default config;
