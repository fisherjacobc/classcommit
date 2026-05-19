import { TRPCError } from "@trpc/server";
import z from "zod";
import { classProtectedProcedure, createTRPCRouter } from "~/server/api/trpc";

export const feedbackRouter = createTRPCRouter({
	getFeedbackForSubmission: classProtectedProcedure
		.input(z.object({ submissionId: z.string().trim().min(1) }))
		.query(async ({ input, ctx }) => {
			const submission = await ctx.db.submission.findFirst({
				where: {
					id: input.submissionId,
					assignment: {
						classId: ctx.class.id,
					},
				},
			});

			if (!submission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission not found for this class.",
				});
			}

			return await ctx.db.feedback.findMany({
				where: { submissionId: input.submissionId },
			});
		}),

	getFeedbackForAssignment: classProtectedProcedure
		.input(z.object({ assignmentId: z.number().int().positive() }))
		.query(async ({ input, ctx }) => {
			// collect submission and group submission ids for the assignment
			const submissions = await ctx.db.submission.findMany({
				where: { assignmentId: input.assignmentId },
				select: { id: true },
			});
			const submissionIds = submissions.map((s) => s.id);

			const groupSubmissions = await ctx.db.groupSubmission.findMany({
				where: { assignmentId: input.assignmentId },
				select: { id: true },
			});
			const groupSubmissionIds = groupSubmissions.map((g) => g.id);

			if (submissionIds.length === 0 && groupSubmissionIds.length === 0)
				return [];

			const feedbackFilters = [] as Array<{
				submissionId?: { in: string[] };
				groupSubmissionId?: { in: string[] };
			}>;

			if (submissionIds.length > 0) {
				feedbackFilters.push({ submissionId: { in: submissionIds } });
			}

			if (groupSubmissionIds.length > 0) {
				feedbackFilters.push({ groupSubmissionId: { in: groupSubmissionIds } });
			}

			return await ctx.db.feedback.findMany({
				where: { OR: feedbackFilters },
			});
		}),

	createFeedback: classProtectedProcedure
		.input(
			z.object({
				submissionId: z.string().optional(),
				groupSubmissionId: z.string().optional(),
				filePath: z.string().min(1),
				startLine: z.number().int().min(1),
				endLine: z.number().int().min(1),
				comment: z.string().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (!input.submissionId && !input.groupSubmissionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "submissionId or groupSubmissionId is required.",
				});
			}

			if (input.submissionId && input.groupSubmissionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Provide only one of submissionId or groupSubmissionId.",
				});
			}

			if (input.submissionId) {
				const submission = await ctx.db.submission.findFirst({
					where: {
						id: input.submissionId,
						assignment: { classId: ctx.class.id },
					},
				});
				if (!submission)
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Submission not found for this class.",
					});
			} else if (input.groupSubmissionId) {
				const gsub = await ctx.db.groupSubmission.findFirst({
					where: {
						id: input.groupSubmissionId,
						assignment: { classId: ctx.class.id },
					},
				});
				if (!gsub)
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Group submission not found for this class.",
					});
			}

			return await ctx.db.feedback.create({
				data: {
					submissionId: input.submissionId ?? undefined,
					groupSubmissionId: input.groupSubmissionId ?? undefined,
					filePath: input.filePath,
					startLine: input.startLine,
					endLine: input.endLine,
					comment: input.comment,
				},
			});
		}),

	updateFeedback: classProtectedProcedure
		.input(
			z.object({
				id: z.string().min(1),
				filePath: z.string().min(1).optional(),
				startLine: z.number().int().min(1).optional(),
				endLine: z.number().int().min(1).optional(),
				comment: z.string().min(1).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const feedback = await ctx.db.feedback.findUnique({
				where: { id: input.id },
			});
			if (!feedback) throw new TRPCError({ code: "NOT_FOUND" });

			// verify feedback belongs to class
			if (feedback.submissionId) {
				const submission = await ctx.db.submission.findFirst({
					where: {
						id: feedback.submissionId,
						assignment: { classId: ctx.class.id },
					},
				});
				if (!submission) throw new TRPCError({ code: "FORBIDDEN" });
			} else if (feedback.groupSubmissionId) {
				const gsub = await ctx.db.groupSubmission.findFirst({
					where: {
						id: feedback.groupSubmissionId,
						assignment: { classId: ctx.class.id },
					},
				});
				if (!gsub) throw new TRPCError({ code: "FORBIDDEN" });
			} else {
				throw new TRPCError({ code: "BAD_REQUEST" });
			}

			return await ctx.db.feedback.update({
				where: { id: input.id },
				data: {
					filePath: input.filePath ?? feedback.filePath,
					startLine: input.startLine ?? feedback.startLine,
					endLine: input.endLine ?? feedback.endLine,
					comment: input.comment ?? feedback.comment,
				},
			});
		}),

	deleteFeedback: classProtectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input, ctx }) => {
			const feedback = await ctx.db.feedback.findUnique({
				where: { id: input.id },
			});
			if (!feedback) throw new TRPCError({ code: "NOT_FOUND" });

			// verify belongs to class
			if (feedback.submissionId) {
				const submission = await ctx.db.submission.findFirst({
					where: {
						id: feedback.submissionId,
						assignment: { classId: ctx.class.id },
					},
				});
				if (!submission) throw new TRPCError({ code: "FORBIDDEN" });
			} else if (feedback.groupSubmissionId) {
				const gsub = await ctx.db.groupSubmission.findFirst({
					where: {
						id: feedback.groupSubmissionId,
						assignment: { classId: ctx.class.id },
					},
				});
				if (!gsub) throw new TRPCError({ code: "FORBIDDEN" });
			}

			await ctx.db.feedback.delete({ where: { id: input.id } });
			return { id: input.id };
		}),
});

export default feedbackRouter;
