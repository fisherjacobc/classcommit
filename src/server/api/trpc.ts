/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { createOAuthUserAuth } from "@octokit/auth-oauth-app";
import { initTRPC, TRPCError } from "@trpc/server";
import { Octokit } from "octokit";
import { CreateOrUpdateFiles } from "octokit-commit-multiple-files";
import superjson from "superjson";
import z, { ZodError } from "zod";
import { env } from "~/env";

import { auth } from "~/server/better-auth";
import { db } from "~/server/db";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
	const session = await auth.api.getSession({
		headers: opts.headers,
	});
	return {
		db,
		session,
		...opts,
	};
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError:
					error.cause instanceof ZodError ? error.cause.flatten() : null,
			},
		};
	},
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
	const start = Date.now();

	if (t._config.isDev) {
		// artificial delay in dev
		const waitMs = Math.floor(Math.random() * 400) + 100;
		await new Promise((resolve) => setTimeout(resolve, waitMs));
	}

	const result = await next();

	const end = Date.now();
	console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

	return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
	.use(timingMiddleware)
	.use(({ ctx, next }) => {
		if (!ctx.session?.user) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}
		return next({
			ctx: {
				// infers the `session` as non-nullable
				session: { ...ctx.session, user: ctx.session.user },
			},
		});
	});

export const githubProtectedProcedure = protectedProcedure.use(
	async ({ ctx, next }) => {
		const githubAccount = await ctx.db.account.findFirst({
			where: {
				providerId: "github",
				userId: ctx.session.user.id,
			},
		});

		if (!githubAccount) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}

		const octokitWithPlugin = Octokit.plugin(CreateOrUpdateFiles);

		const octokit = new octokitWithPlugin({
			authStrategy: createOAuthUserAuth,
			auth: {
				// clientType: githubAccount.type,
				clientId: env.BETTER_AUTH_GITHUB_CLIENT_ID,
				clientSecret: env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
				token: githubAccount.accessToken,
				scopes: "read:user user:email repo",
				refreshToken: githubAccount.refreshToken,
				expiresAt: githubAccount.accessTokenExpiresAt,
				refreshTokenExpiresAt: githubAccount.refreshTokenExpiresAt,
			},
		});

		const repos = (
			await octokit.request(`GET /user/repos`, {
				per_page: 100,
			})
		).data;

		return next({
			ctx: {
				// infers the `session` as non-nullable
				session: {
					...ctx.session,
					githubAccount: {
						...githubAccount,
						repos,
					},
				},
				github: octokit,
			},
		});
	},
);

export const classProtectedProcedure = githubProtectedProcedure
	.input(z.object({ classId: z.number().int().positive() }))
	.use(async ({ input, ctx, next }) => {
		const classResult = await ctx.db.class.findUnique({
			where: { id: input.classId },
		});

		if (!classResult) {
			throw new TRPCError({
				code: "NOT_FOUND",
			});
		}

		const membership = await ctx.db.classMembership.findUnique({
			where: {
				userId_classId: {
					userId: ctx.session.user.id,
					classId: input.classId,
				},
			},
		});

		if (!membership) {
			throw new TRPCError({
				code: "FORBIDDEN",
			});
		}

		const ownerMembership = await ctx.db.classMembership.findFirst({
			where: {
				classId: input.classId,
				role: "OWNER",
			},
		});

		if (!ownerMembership) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Class has no owner",
			});
		}

		const githubAccount = await ctx.db.account.findFirst({
			where: {
				providerId: "github",
				userId: ownerMembership.userId,
			},
		});

		if (!githubAccount) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}

		const octokitWithPlugin = Octokit.plugin(CreateOrUpdateFiles);

		const octokit = new octokitWithPlugin({
			authStrategy: createOAuthUserAuth,
			auth: {
				// clientType: githubAccount.type,
				clientId: env.BETTER_AUTH_GITHUB_CLIENT_ID,
				clientSecret: env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
				token: githubAccount.accessToken,
				scopes: "read:user user:email repo",
				refreshToken: githubAccount.refreshToken,
				expiresAt: githubAccount.accessTokenExpiresAt,
				refreshTokenExpiresAt: githubAccount.refreshTokenExpiresAt,
			},
		});

		return next({
			ctx: {
				class: classResult,
				membership: membership,
				classOwnerGithub: octokit,
			},
		});
	});

export const assignmentsProtectedProcedure = classProtectedProcedure.input(
	z.object({ assignmentId: z.number().int().positive() }),
);
