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

			return await ctx.db.class.create({
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
		}),
});
