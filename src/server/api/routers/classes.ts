import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";

export const classesRouter = createTRPCRouter({
	getClasses: protectedProcedure.query(async ({ ctx }) => {
		const user = ctx.session.user;

		const classes = ctx.db.class.findMany({
			where: {
				createdById: user.id,
			},
			include: {
				createdBy: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		});

		return classes;
	}),

	getClass: protectedProcedure
		.input(z.object({ classId: z.number().int().positive() }))
		.query(async ({ input: { classId }, ctx }) => {
			const user = ctx.session.user;

			const classResult = await ctx.db.class.findUnique({
				where: {
					id: classId,
				},
				include: {
					createdBy: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			});

			if (!classResult)
				throw new TRPCError({
					code: "NOT_FOUND",
				});

			if (classResult.createdById !== user.id)
				throw new TRPCError({
					code: "UNAUTHORIZED",
				});

			return classResult;
		}),

	createClass: protectedProcedure
		.input(z.object({ className: z.string(), term: z.string() }))
		.mutation(async ({ input, ctx }) => {
			return ctx.db.class.create({
				data: {
					name: input.className,
					term: input.term,
					homepageMarkdown: `# Welcome to ${input.className}`,
					createdBy: { connect: { id: ctx.session.user.id } },
				},
			});
		}),
});
