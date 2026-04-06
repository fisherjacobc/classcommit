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
			const newAssignment = await ctx.db.assignment.create({
				data: {
					...input,
					classId: ctx.class.id,
					published: false,
				},
			});

			const [owner, repo] = ctx.class.githubRepo.split("/");

			if (!owner || !repo) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid GitHub repository format. Expected owner/repo.",
				});
			}

			// Create README.md in assignment folder
			await ctx.github.request(
				"PUT /repos/{owner}/{repo}/contents/{path}",
				{
					owner,
					repo,
					path: `assignments/${newAssignment.id}/README.md`,
					message: `Initialize assignment "${input.name}" README`,
					content: Buffer.from(
						`# ${input.name}\nEdit this page on your GitHub repo`,
					).toString("base64"),
				},
			);

			// Create .gitkeep in sourcefiles folder
			await ctx.github.request(
				"PUT /repos/{owner}/{repo}/contents/{path}",
				{
					owner,
					repo,
					path: `assignments/${newAssignment.id}/sourcefiles/.gitkeep`,
					message: `Initialize sourcefiles directory for assignment "${input.name}"`,
					content: Buffer.from("").toString("base64"),
				},
			);

			return newAssignment;
		}),

	publishAssignment: assignmentsProtectedProcedure
		.input(
			z.object({
				isPublished: z.boolean(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			return await ctx.db.assignment.update({
				where: {
					id: input.assignmentId,
				},
				data: {
					published: input.isPublished,
				},
			});
		}),
});
