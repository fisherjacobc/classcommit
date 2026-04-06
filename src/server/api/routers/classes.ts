import { TRPCError } from "@trpc/server";
import { z } from "zod";

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
		if (typeof content === "object" && "content" in content && content.content) {
			return Buffer.from(content.content as string, "base64").toString(
				"utf-8",
			);
		}

		throw new TRPCError({
			code: "NOT_FOUND",
			message: "README.md not found in repository",
		});
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

			await ctx.github.request(
				"PUT /repos/{owner}/{repo}/contents/{path}",
				{
					owner,
					repo,
					path: "README.md",
					message: "Initialize class README",
					content: Buffer.from(
						`# ${input.className}\nEdit this page on your GitHub repo`,
					).toString("base64"),
				},
			);

			return newClass;
		}),
});
