import { z } from "zod";

import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";

export const classesRouter = createTRPCRouter({
	hello: publicProcedure
		.input(z.object({ text: z.string() }))
		.query(({ input }) => {
			return {
				greeting: `Hello ${input.text}`,
			};
		}),

	getClasses: protectedProcedure.query(async ({ ctx }) => {
		const user = ctx.session.user;

		const classes = ctx.db.class.findMany({
			where: {
				createdById: user.id,
			}
		});

		return classes;
	}),

	createClass: protectedProcedure.input(z.object({ className: z.string(), term: z.string() })).query(async ({ input, ctx }) => {
		const user = ctx.db.user.findUnique({
			where: {
				id: ctx.session.user.id,
			}
		})

		ctx.db.class.create({
			data: {
				name: input.className, 
				term: input.term,
				createdBy: { connect: { id: ctx.session.user.id } }
			}
		})
	})

});