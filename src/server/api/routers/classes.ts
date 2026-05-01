import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "~/env";

import {
	classProtectedProcedure,
	createTRPCRouter,
	githubProtectedProcedure,
	protectedProcedure,
} from "~/server/api/trpc";

export const classesRouter = createTRPCRouter({
	getClasses: protectedProcedure.query(async ({ ctx }) => {
		const classes = await ctx.db.classMembership.findMany({
			where: { userId: ctx.session.user.id },
			include: {
				class: true,
			},
		});

		return classes;
	}),

	getClass: classProtectedProcedure.query(async ({ ctx }) => {
		return ctx.class;
	}),

	getHomepage: classProtectedProcedure.query(async ({ ctx }) => {
		const [owner, repo] = ctx.class.githubRepo.split("/");

		if (!owner || !repo) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Invalid GitHub repository format. Expected owner/repo.",
			});
		}

		const response = await ctx.github.request(
			"GET /repos/{owner}/{repo}/contents/{path}",
			{
				owner,
				repo,
				path: "README.md",
			},
		);

		const content = response.data;
		if (
			typeof content === "object" &&
			"content" in content &&
			content.content
		) {
			return Buffer.from(content.content as string, "base64").toString("utf-8");
		}

		throw new TRPCError({
			code: "NOT_FOUND",
			message: "README.md not found in repository",
		});
	}),

	joinClass: protectedProcedure
		.input(
			z.object({
				joinCode: z.string().trim().min(1, "Join code is required."),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const classToJoin = await ctx.db.class.findFirst({
				where: {
					joinCode: input.joinCode,
				},
			});

			if (!classToJoin) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Invalid class join code.",
				});
			}

			const existingMembership = await ctx.db.classMembership.findUnique({
				where: {
					userId_classId: {
						userId: ctx.session.user.id,
						classId: classToJoin.id,
					},
				},
			});

			if (existingMembership) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "You are already a member of this class.",
				});
			}

			await ctx.db.classMembership.create({
				data: {
					userId: ctx.session.user.id,
					classId: classToJoin.id,
					role: "STUDENT",
				},
			});

			return classToJoin;
		}),

	createClass: githubProtectedProcedure
		.input(
			z.object({
				className: z.string(),
				term: z.string().optional(),
				githubRepo: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			let hasRepoAccess = false;

			ctx.session.githubAccount.repos.forEach((repo) => {
				if (repo.full_name === input.githubRepo) hasRepoAccess = true;
			});

			if (!hasRepoAccess)
				throw new TRPCError({
					code: "FORBIDDEN",
				});

			const [owner, repo] = input.githubRepo.split("/");

			if (!owner || !repo) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid GitHub repository format. Expected owner/repo.",
				});
			}

			const newClass = await ctx.db.class.create({
				data: {
					name: input.className,
					term: input.term,
					githubRepo: input.githubRepo,
					members: {
						create: {
							userId: ctx.session.user.id,
							role: "OWNER",
						},
					},
				},
			});

			let sha: string | undefined;
			try {
				const file = await ctx.github.rest.repos.getContent({
					owner: owner,
					repo: repo,
					path: "README.md",
				});

				if (!Array.isArray(file.data) && typeof file.data.sha === "string") {
					sha = file.data.sha;
				}
			} catch {
				// Missing file is expected on first write; continue without sha.
			}

			await ctx.github.request("PUT /repos/{owner}/{repo}/contents/{path}", {
				owner,
				repo,
				path: "README.md",
				message: "Initialize class README",
				content: Buffer.from(
					`# ${input.className}\nEdit this page on your GitHub repo`,
				).toString("base64"),
				...(sha ? { sha } : {}),
				committer: {
					name: env.GITHUB_APP_NAME,
					email: `${env.GITHUB_APP_ID}+${env.GITHUB_APP_NAME}@users.noreply.github.com`,
				},
			});

			return newClass;
		}),

	getMembers: classProtectedProcedure.query(async ({ ctx }) => {
		const memberships = await ctx.db.classMembership.findMany({
			where: { classId: ctx.class.id },
			include: {
				user: true,
			},
		});

		return memberships;
	}),
});
