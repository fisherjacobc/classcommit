import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";

export const assignmentsRouter = createTRPCRouter({
	createAssignment: protectedProcedure
		.input(
			z.object({
				name: z.string(),
				dueDate: z.date().optional(),
				points: z.number().int().gte(0),
				classId: z.number().int().positive(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			return ctx.db.assignment.create({
				data: {
					name: input.name,
					dueDate: input.dueDate,
					points: input.points,
					description: `# ${input.name}`,
					class: { connect: { id: input.classId } },
				},
			});
		}),

	getAssignment: protectedProcedure
		.input(
			z.object({
				classId: z.number().int().positive(),
				assignmentId: z.string(),
			}),
		)
		.query(async ({ input: { classId, assignmentId }, ctx }) => {
			const assignmentResult = await ctx.db.assignment.findUnique({
				where: {
					id: assignmentId,
					classId,
				},
			});

			if (!assignmentResult)
				throw new TRPCError({
					code: "NOT_FOUND",
				});

			return assignmentResult;
		}),

	getAssignmentsForClass: protectedProcedure
		.input(
			z.object({
				classId: z.number().int().positive(),
			}),
		)
		.query(async ({ input: { classId }, ctx }) => {
			return ctx.db.assignment.findMany({
				where: {
					classId,
				},
			});
		}),
});
