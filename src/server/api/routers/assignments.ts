import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { env } from "~/env";
import {
	assignmentsProtectedProcedure,
	classProtectedProcedure,
	createTRPCRouter,
} from "../trpc";

const ensureTeacherRole = (role: "OWNER" | "TEACHER" | "STUDENT") => {
	if (role === "STUDENT") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only teachers can perform this action.",
		});
	}
};

const ensureStudentRole = (role: "OWNER" | "TEACHER" | "STUDENT") => {
	if (role !== "STUDENT") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only students can perform this action.",
		});
	}
};

const parseOwnerRepo = (githubRepo: string) => {
	const [owner, repo] = githubRepo.split("/");

	if (!owner || !repo) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Invalid GitHub repository format. Expected owner/repo.",
		});
	}

	return { owner, repo };
};

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

	getMyAssignmentFiles: assignmentsProtectedProcedure.query(
		async ({ input, ctx }) => {
			ensureStudentRole(ctx.membership.role);

			const assignment = await ctx.db.assignment.findFirst({
				where: {
					id: input.assignmentId,
					classId: ctx.class.id,
				},
				select: {
					id: true,
					published: true,
				},
			});

			if (!assignment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Assignment not found.",
				});
			}

			if (!assignment.published) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Assignment has not been published yet.",
				});
			}

			const submission = await ctx.db.submission.findUnique({
				where: {
					assignmentId_studentId: {
						assignmentId: input.assignmentId,
						studentId: ctx.session.user.id,
					},
				},
				select: {
					id: true,
					submittedAt: true,
					grade: true,
					ref: true,
				},
			});

			if (!submission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission workspace was not found for this assignment.",
				});
			}

			const { owner, repo } = parseOwnerRepo(ctx.class.githubRepo);
			const repoInfo = ctx.session.githubAccount.repos.find(
				(repoResult) => repoResult.full_name === ctx.class.githubRepo,
			);

			if (!repoInfo) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "GitHub repository metadata could not be found.",
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

			const submissionPrefix = `assignments/${input.assignmentId}/submissions/${submission.id}/`;
			const submissionPaths = treeResponse.data.tree
				.filter(
					(treeItem) =>
						treeItem.type === "blob" &&
						typeof treeItem.path === "string" &&
						treeItem.path.startsWith(submissionPrefix),
				)
				.map((treeItem) => treeItem.path);

			const files = await Promise.all(
				submissionPaths.map(async (path) => {
					const fileResponse = await ctx.github.request(
						"GET /repos/{owner}/{repo}/contents/{path}",
						{
							owner,
							repo,
							path,
						},
					);

					if (
						Array.isArray(fileResponse.data) ||
						!("content" in fileResponse.data) ||
						typeof fileResponse.data.content !== "string"
					) {
						throw new TRPCError({
							code: "INTERNAL_SERVER_ERROR",
							message: `Could not load ${path} from GitHub.`,
						});
					}

					return {
						path: path.slice(submissionPrefix.length),
						content: Buffer.from(
							fileResponse.data.content.replace(/\n/g, ""),
							"base64",
						).toString("utf-8"),
					};
				}),
			);

			return {
				submission,
				files,
			};
		},
	),

	updateMyAssignmentFiles: assignmentsProtectedProcedure
		.input(
			z.object({
				message: z.string().trim().min(1, "Commit message is required."),
				files: z
					.array(
						z.object({
							path: z.string().trim().min(1, "File path is required."),
							content: z.string(),
						}),
					)
					.min(1, "At least one file is required."),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			ensureStudentRole(ctx.membership.role);

			const assignment = await ctx.db.assignment.findFirst({
				where: {
					id: input.assignmentId,
					classId: ctx.class.id,
				},
				select: {
					id: true,
					published: true,
				},
			});

			if (!assignment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Assignment not found.",
				});
			}

			if (!assignment.published) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Assignment has not been published yet.",
				});
			}

			const submission = await ctx.db.submission.findUnique({
				where: {
					assignmentId_studentId: {
						assignmentId: input.assignmentId,
						studentId: ctx.session.user.id,
					},
				},
				select: {
					id: true,
				},
			});

			if (!submission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission workspace was not found for this assignment.",
				});
			}

			const { owner, repo } = parseOwnerRepo(ctx.class.githubRepo);
			const repoInfo = ctx.session.githubAccount.repos.find(
				(repoResult) => repoResult.full_name === ctx.class.githubRepo,
			);

			if (!repoInfo) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "GitHub repository metadata could not be found.",
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

			const sourcePrefix = `assignments/${input.assignmentId}/sourcefiles/`;
			const allowedRelativePaths = new Set(
				treeResponse.data.tree
					.filter(
						(treeItem) =>
							treeItem.type === "blob" &&
							typeof treeItem.path === "string" &&
							treeItem.path.startsWith(sourcePrefix),
					)
					.map((treeItem) => treeItem.path.slice(sourcePrefix.length)),
			);

			const sanitizedFiles = input.files.map((file) => {
				const trimmedPath = file.path.trim();

				if (
					trimmedPath.startsWith("/") ||
					trimmedPath.includes("..") ||
					trimmedPath.length === 0
				) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Invalid file path: ${file.path}`,
					});
				}

				if (!allowedRelativePaths.has(trimmedPath)) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: `File is not editable for this assignment: ${trimmedPath}`,
					});
				}

				return {
					path: trimmedPath,
					content: file.content,
				};
			});

			const studentGitHubProfile = await ctx.github.request("GET /user");
			const authorLogin = studentGitHubProfile.data.login;
			const authorName =
				studentGitHubProfile.data.name ?? authorLogin ?? ctx.session.user.name;
			const authorEmail =
				studentGitHubProfile.data.email ??
				(authorLogin
					? `${authorLogin}@users.noreply.github.com`
					: `${ctx.session.user.id}@users.noreply.github.com`);

			const files = Object.fromEntries(
				sanitizedFiles.map((file) => [
					`assignments/${input.assignmentId}/submissions/${submission.id}/${file.path}`,
					file.content,
				]),
			);

			const commitResult = await ctx.github.createOrUpdateFiles({
				owner,
				repo,
				branch: repoInfo.default_branch,
				createBranch: false,
				committer: {
					name: env.GITHUB_APP_NAME,
					email: `${env.GITHUB_APP_ID}+${env.GITHUB_APP_NAME}@users.noreply.github.com`,
				},
				author: {
					name: authorName,
					email: authorEmail,
				},
				changes: [
					{
						message: input.message,
						files,
					},
				],
			});

			const latestCommitSha = commitResult.commits.at(-1)?.sha;

			if (!latestCommitSha) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "No commit was returned after updating submission files.",
				});
			}

			const updatedSubmission = await ctx.db.submission.update({
				where: {
					id: submission.id,
				},
				data: {
					ref: latestCommitSha,
				},
			});

			return {
				submission: updatedSubmission,
				commitSha: latestCommitSha,
			};
		}),

	submitMyAssignment: assignmentsProtectedProcedure.mutation(
		async ({ input, ctx }) => {
			ensureStudentRole(ctx.membership.role);

			const assignment = await ctx.db.assignment.findFirst({
				where: {
					id: input.assignmentId,
					classId: ctx.class.id,
				},
				select: {
					id: true,
					published: true,
				},
			});

			if (!assignment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Assignment not found.",
				});
			}

			if (!assignment.published) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Assignment has not been published yet.",
				});
			}

			const submission = await ctx.db.submission.findUnique({
				where: {
					assignmentId_studentId: {
						assignmentId: input.assignmentId,
						studentId: ctx.session.user.id,
					},
				},
				select: {
					id: true,
				},
			});

			if (!submission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission workspace was not found for this assignment.",
				});
			}

			return await ctx.db.submission.update({
				where: {
					id: submission.id,
				},
				data: {
					submittedAt: new Date(),
				},
			});
		},
	),

	getAssignmentSubmissions: assignmentsProtectedProcedure.query(
		async ({ input, ctx }) => {
			ensureTeacherRole(ctx.membership.role);

			const assignment = await ctx.db.assignment.findFirst({
				where: {
					id: input.assignmentId,
					classId: ctx.class.id,
				},
				select: {
					id: true,
				},
			});

			if (!assignment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Assignment not found.",
				});
			}

			return await ctx.db.submission.findMany({
				where: {
					assignmentId: input.assignmentId,
				},
				include: {
					student: {
						select: {
							id: true,
							handle: true,
							name: true,
							email: true,
							image: true,
						},
					},
				},
				orderBy: {
					submittedAt: "desc",
				},
			});
		},
	),

	getAssignmentSubmission: assignmentsProtectedProcedure
		.input(
			z.object({
				submissionId: z.string().trim().min(1, "Submission ID is required."),
			}),
		)
		.query(async ({ input, ctx }) => {
			ensureTeacherRole(ctx.membership.role);

			const submission = await ctx.db.submission.findFirst({
				where: {
					id: input.submissionId,
					assignmentId: input.assignmentId,
					assignment: {
						classId: ctx.class.id,
					},
				},
				include: {
					student: {
						select: {
							id: true,
							handle: true,
							name: true,
							email: true,
							image: true,
						},
					},
					assignment: {
						select: {
							id: true,
							name: true,
							points: true,
						},
					},
				},
			});

			if (!submission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission not found for this assignment.",
				});
			}

			return submission;
		}),

	gradeAssignmentSubmission: assignmentsProtectedProcedure
		.input(
			z.object({
				submissionId: z.string().trim().min(1, "Submission ID is required."),
				grade: z.number().min(0, "Grade must be 0 or greater."),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			ensureTeacherRole(ctx.membership.role);

			const assignment = await ctx.db.assignment.findFirst({
				where: {
					id: input.assignmentId,
					classId: ctx.class.id,
				},
				select: {
					id: true,
					points: true,
				},
			});

			if (!assignment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Assignment not found.",
				});
			}

			if (input.grade > assignment.points) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Grade cannot exceed ${assignment.points} points.`,
				});
			}

			const existingSubmission = await ctx.db.submission.findFirst({
				where: {
					id: input.submissionId,
					assignmentId: input.assignmentId,
					assignment: {
						classId: ctx.class.id,
					},
				},
				select: {
					id: true,
				},
			});

			if (!existingSubmission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission not found for this assignment.",
				});
			}

			return await ctx.db.submission.update({
				where: {
					id: input.submissionId,
				},
				data: {
					grade: input.grade,
				},
			});
		}),

	getAssignmentRubric: assignmentsProtectedProcedure.query(
		async ({ input, ctx }) => {
			ensureTeacherRole(ctx.membership.role);

			const assignment = await ctx.db.assignment.findFirst({
				where: {
					id: input.assignmentId,
					classId: ctx.class.id,
				},
				select: {
					id: true,
					points: true,
				},
			});

			if (!assignment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Assignment not found.",
				});
			}

			const { owner, repo } = parseOwnerRepo(ctx.class.githubRepo);
			const rubricPath = `assignments/${input.assignmentId}/rubric.json`;

			try {
				const response = await ctx.github.request(
					"GET /repos/{owner}/{repo}/contents/{path}",
					{
						owner,
						repo,
						path: rubricPath,
					},
				);

				if (
					Array.isArray(response.data) ||
					!("content" in response.data) ||
					typeof response.data.content !== "string"
				) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Rubric file format is invalid.",
					});
				}

				const decoded = Buffer.from(
					response.data.content.replace(/\n/g, ""),
					"base64",
				).toString("utf-8");

				return {
					rubric: JSON.parse(decoded),
					sha: response.data.sha,
				};
			} catch {
				return {
					rubric: null,
					sha: undefined,
				};
			}
		},
	),

	upsertAssignmentRubric: assignmentsProtectedProcedure
		.input(
			z.object({
				title: z.string().trim().min(1, "Rubric title is required."),
				criteria: z.array(
					z.object({
						name: z.string().trim().min(1, "Criterion name is required."),
						description: z.string().trim().optional(),
						points: z.number().min(0, "Criterion points must be 0 or greater."),
					}),
				),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			ensureTeacherRole(ctx.membership.role);

			const assignment = await ctx.db.assignment.findFirst({
				where: {
					id: input.assignmentId,
					classId: ctx.class.id,
				},
				select: {
					id: true,
					points: true,
				},
			});

			if (!assignment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Assignment not found.",
				});
			}

			const rubricPointsTotal = input.criteria.reduce(
				(total, criterion) => total + criterion.points,
				0,
			);

			if (rubricPointsTotal > assignment.points) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Rubric points (${rubricPointsTotal}) cannot exceed assignment points (${assignment.points}).`,
				});
			}

			const { owner, repo } = parseOwnerRepo(ctx.class.githubRepo);
			const rubricPath = `assignments/${input.assignmentId}/rubric.json`;

			let sha: string | undefined;
			try {
				const existingRubric = await ctx.github.request(
					"GET /repos/{owner}/{repo}/contents/{path}",
					{
						owner,
						repo,
						path: rubricPath,
					},
				);

				if (
					!Array.isArray(existingRubric.data) &&
					typeof existingRubric.data.sha === "string"
				) {
					sha = existingRubric.data.sha;
				}
			} catch {
				// Missing rubric file is expected for first-time creation.
			}

			const rubricPayload = {
				title: input.title,
				criteria: input.criteria,
				totalPoints: rubricPointsTotal,
				assignmentPoints: assignment.points,
				updatedAt: new Date().toISOString(),
			};

			const result = await ctx.github.request(
				"PUT /repos/{owner}/{repo}/contents/{path}",
				{
					owner,
					repo,
					path: rubricPath,
					message: `Update rubric for assignment ${input.assignmentId}`,
					content: Buffer.from(JSON.stringify(rubricPayload, null, 2)).toString(
						"base64",
					),
					committer: {
						name: env.GITHUB_APP_NAME,
						email: `${env.GITHUB_APP_ID}+${env.GITHUB_APP_NAME}@users.noreply.github.com`,
					},
					...(sha ? { sha } : {}),
				},
			);

			return {
				rubric: rubricPayload,
				sha: result.data.content?.sha,
			};
		}),

	createAssignment: classProtectedProcedure
		.input(
			z.object({
				name: z.string(),
				points: z.number().int().positive(),
				dueDate: z.date().optional(),
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

			const { owner, repo } = parseOwnerRepo(ctx.class.githubRepo);

			const getFileSha = async (path: string) => {
				try {
					const existingFile = await ctx.github.request(
						"GET /repos/{owner}/{repo}/contents/{path}",
						{
							owner,
							repo,
							path,
						},
					);

					if (
						!Array.isArray(existingFile.data) &&
						typeof existingFile.data.sha === "string"
					) {
						return existingFile.data.sha;
					}
				} catch {
					// Missing file is expected on first write; continue without sha.
				}

				return undefined;
			};

			const readmePath = `assignments/${newAssignment.id}/README.md`;
			const readmeSha = await getFileSha(readmePath);

			// Create README.md in assignment folder
			await ctx.github.request("PUT /repos/{owner}/{repo}/contents/{path}", {
				owner,
				repo,
				path: readmePath,
				message: `Initialize assignment "${input.name}" README`,
				content: Buffer.from("Edit this page on your GitHub repo").toString(
					"base64",
				),
				committer: {
					name: env.GITHUB_APP_NAME,
					email: `${env.GITHUB_APP_ID}+${env.GITHUB_APP_NAME}@users.noreply.github.com`,
				},
				...(readmeSha ? { sha: readmeSha } : {}),
			});

			const gitkeepPath = `assignments/${newAssignment.id}/sourcefiles/.gitkeep`;
			const gitkeepSha = await getFileSha(gitkeepPath);

			// Create .gitkeep in sourcefiles folder
			await ctx.github.request("PUT /repos/{owner}/{repo}/contents/{path}", {
				owner,
				repo,
				path: gitkeepPath,
				message: `Initialize sourcefiles directory for assignment "${input.name}"`,
				content: Buffer.from("").toString("base64"),
				committer: {
					name: env.GITHUB_APP_NAME,
					email: `${env.GITHUB_APP_ID}+${env.GITHUB_APP_NAME}@users.noreply.github.com`,
				},
				...(gitkeepSha ? { sha: gitkeepSha } : {}),
			});

			return newAssignment;
		}),

	getReadme: assignmentsProtectedProcedure.query(async ({ ctx, input }) => {
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
				path: `assignments/${input.assignmentId}/README.md`,
			},
		);

		const content = response.data;
		if (
			typeof content === "object" &&
			"content" in content &&
			content.content
		) {
			return Buffer.from(content.content as string, "base64").toString("utf-8");
		}

		throw new TRPCError({
			code: "NOT_FOUND",
			message: "README.md not found in assignment folder",
		});
	}),

	publishAssignment: assignmentsProtectedProcedure.mutation(
		async ({ input, ctx }) => {
			ensureTeacherRole(ctx.membership.role);

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

			const { owner, repo } = parseOwnerRepo(ctx.class.githubRepo);

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
				existingSubmissions.map((submission) => [
					submission.studentId,
					submission,
				]),
			);

			const submissionsToCreate = studentMembers.filter(
				(studentMember) =>
					!existingSubmissionsByStudentId.has(studentMember.userId),
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

			const submissions = [...existingSubmissions, ...createdSubmissions].sort(
				(left, right) => left.studentId.localeCompare(right.studentId),
			);

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
						sourceFileContents
							.filter(({ content }) => content.length > 0)
							.map(({ relativePath, content }) => [
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
				committer: {
					name: env.GITHUB_APP_NAME,
					email: `${env.GITHUB_APP_ID}+${env.GITHUB_APP_NAME}@users.noreply.github.com`,
				},
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
		},
	),
});
