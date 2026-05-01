import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { env } from "~/env";
import { db } from "~/server/db";

export const auth = betterAuth({
	database: prismaAdapter(db, {
		provider: "postgresql", // or "sqlite" or "mysql"
	}),
	advanced: {
		cookies: {
			state: {
				attributes: {
					sameSite: "none",
					secure: true,
				},
			},
		},
	},
	socialProviders: {
		github: {
			clientId: env.BETTER_AUTH_GITHUB_CLIENT_ID,
			clientSecret: env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
			redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/github`,
			scope: ["read:user", "user:email", "repo"],
			mapProfileToUser: async (profile) => {
				return {
					handle: profile.login,
				};
			},
		},
	},
	user: {
		additionalFields: {
			handle: {
				type: "string",
				required: true,
			},
		},
	},
	plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
