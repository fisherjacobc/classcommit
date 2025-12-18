import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";

export const assignmentsRouter = createTRPCRouter({
	createAssignment: protectedProcedure
		.input(z.object({ name: z.string(), date: z.date(), points: z.number().int().positive(), classId: z.number().int().positive() }))
		.mutation(async ({ input, ctx }) => {
			return ctx.db.assignment.create({
				data: {
					name: input.name,
					dueDate: input.date,
					points: input.points,
					description: `# ${input.name}`,
					class: { connect: { id: input.classId } },
				},
			});
		}),
});
