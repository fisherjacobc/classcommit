import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
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
			if (!input.isPublished) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Assignments cannot be unpublished.",
				});
			}

			const assignment = await ctx.db.assignment.findUnique({
				where: {
					id: input.assignmentId,
				},
			});

			if (!assignment) {
				throw new TRPCError({
					code: "NOT_FOUND",
				});
			}

			if (assignment.published) {
				return assignment;
			}

			const [owner, repo] = ctx.class.githubRepo.split("/");

			if (!owner || !repo) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid GitHub repository format. Expected owner/repo.",
				});
			}

			const repoInfo = ctx.session.githubAccount.repos.find(
				(repoResult) => repoResult.full_name === ctx.class.githubRepo,
			);

			if (!repoInfo) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "GitHub repository metadata could not be found.",
				});
			}

			const studentMembers = await ctx.db.classMembership.findMany({
				where: {
					classId: ctx.class.id,
					role: "STUDENT",
				},
				select: {
					userId: true,
					user: {
						select: {
							handle: true,
							name: true,
						},
					},
				},
			});

			const existingSubmissions = await ctx.db.submission.findMany({
				where: {
					assignmentId: input.assignmentId,
				},
				select: {
					id: true,
					studentId: true,
					ref: true,
				},
			});

			const existingSubmissionsByStudentId = new Map(
				existingSubmissions.map((submission) => [submission.studentId, submission]),
			);

			const submissionsToCreate = studentMembers.filter(
				(studentMember) => !existingSubmissionsByStudentId.has(studentMember.userId),
			);

			const createdSubmissions = await ctx.db.$transaction(
				submissionsToCreate.map((studentMember) =>
					ctx.db.submission.create({
						data: {
							id: randomUUID(),
							assignmentId: input.assignmentId,
							studentId: studentMember.userId,
							ref: "pending",
						},
					}),
				),
			);

			const submissions = [
				...existingSubmissions,
				...createdSubmissions,
			].sort((left, right) => left.studentId.localeCompare(right.studentId));

			if (studentMembers.length === 0) {
				return await ctx.db.assignment.update({
					where: {
						id: input.assignmentId,
					},
					data: {
						published: true,
					},
				});
			}

			const branchResponse = await ctx.github.request(
				"GET /repos/{owner}/{repo}/branches/{branch}",
				{
					owner,
					repo,
					branch: repoInfo.default_branch,
				},
			);

			const treeResponse = await ctx.github.request(
				"GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
				{
					owner,
					repo,
					tree_sha: branchResponse.data.commit.sha,
					recursive: "1",
				},
			);

			const sourceFilesPrefix = `assignments/${input.assignmentId}/sourcefiles/`;
			const sourceFiles = treeResponse.data.tree
				.filter(
					(treeItem) =>
						treeItem.type === "blob" &&
						typeof treeItem.path === "string" &&
						treeItem.path.startsWith(sourceFilesPrefix),
				)
				.map((treeItem) => treeItem.path);

			const sourceFileContents = await Promise.all(
				sourceFiles.map(async (path) => {
					const contentResponse = await ctx.github.request(
						"GET /repos/{owner}/{repo}/contents/{path}",
						{
							owner,
							repo,
							path,
						},
					);

					if (!("content" in contentResponse.data)) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Could not load ${path} from GitHub.`,
						});
					}

					return {
						relativePath: path.slice(sourceFilesPrefix.length),
						content: contentResponse.data.content.replace(/\n/g, ""),
					};
				}),
			);

			const submissionFiles = submissions.map((submission) => {
				const studentMember = studentMembers.find(
					(member) => member.userId === submission.studentId,
				);

				return {
					message: `Create submission for ${studentMember?.user.handle ?? studentMember?.user.name ?? submission.studentId}`,
					files: Object.fromEntries(
						sourceFileContents.map(({ relativePath, content }) => [
							`assignments/${input.assignmentId}/submissions/${submission.id}/${relativePath}`,
							content,
						]),
					),
				};
			});

			const commitResult = await ctx.github.createOrUpdateFiles({
				owner,
				repo,
				branch: repoInfo.default_branch,
				createBranch: false,
				changes: submissionFiles,
			});

			if (commitResult.commits.length !== submissions.length) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Submission commits were not created for every student.",
				});
			}

			await ctx.db.$transaction(
				submissions.map((submission, index) =>
					ctx.db.submission.update({
						where: {
							id: submission.id,
						},
						data: {
							ref: commitResult.commits[index]?.sha ?? submission.ref,
						},
					}),
				),
			);

			return await ctx.db.assignment.update({
				where: {
					id: input.assignmentId,
				},
				data: {
					published: true,
				},
			});
		}),
});
