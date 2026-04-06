import { TRPCError } from "@trpc/server";
import z from "zod";
import {
	assignmentsProtectedProcedure,
	classProtectedProcedure,
	createTRPCRouter,
} from "../trpc";

export const assignmentsRouter = createTRPCRouter({
	getAssignments: classProtectedProcedure.query(async ({ ctx }) => {
		const assignments = await ctx.db.assignment.findMany({
			where: {
				classId: ctx.class.id,
				class: {
					members: {
						some: {
							userId: ctx.session.user.id,
						},
					},
				},
			},
			orderBy: {
				dueDate: "asc",
			},
		});

		return assignments;
	}),

	getAssignment: assignmentsProtectedProcedure.query(async ({ input, ctx }) => {
		const assignment = await ctx.db.assignment.findUnique({
			where: {
				classId: ctx.class.id,
				class: {
					members: {
						some: {
							userId: ctx.session.user.id,
						},
					},
				},
				id: input.assignmentId,
			},
		});

		if (!assignment) {
			throw new TRPCError({
				code: "NOT_FOUND",
			});
		}

		return assignment;
	}),

	createAssignment: classProtectedProcedure
		.input(
			z.object({
				name: z.string(),
				points: z.number().int().positive(),
				dueDate: z.date(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			return await ctx.db.assignment.create({
				data: {
					...input,
					classId: ctx.class.id,
				},
			});
		}),
});
