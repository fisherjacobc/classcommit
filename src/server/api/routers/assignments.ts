import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { env } from "~/env";
import {
	assignmentsProtectedProcedure,
	classProtectedProcedure,
	createTRPCRouter,
} from "../trpc";
import { runJavaCode } from "./compiler";
import feedbackRouter from "./feedback";

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

const getClassOwnerRepoInfo = async (ctx: {
	class: { githubRepo: string };
	classOwnerGithub: {
		request: (...args: Array<unknown>) => Promise<{ data: unknown }>;
	};
}) => {
	const { owner, repo } = parseOwnerRepo(ctx.class.githubRepo);
	const response = (await ctx.classOwnerGithub.request(
		"GET /repos/{owner}/{repo}",
		{ owner, repo },
	)) as { data: { default_branch: string } };

	return {
		owner,
		repo,
		defaultBranch: response.data.default_branch,
	};
};

const hasExpectedCodeOutput = (
	criteria: Array<{ expectedCodeOutput?: string | null }>,
) => criteria.every((criterion) => criterion.expectedCodeOutput?.length);

const mapRubric = (
	rubric: {
		id: number;
		title: string;
		createdAt: Date;
		updatedAt: Date;
		criteria: Array<{
			id: number;
			position: number;
			name: string;
			description: string | null;
			points: number;
			expectedCodeOutput: string | null;
		}>;
	},
	assignmentPoints: number,
	autogradeWithRubric: boolean,
) => ({
	id: rubric.id,
	title: rubric.title,
	criteria: rubric.criteria.map((criterion) => ({
		id: criterion.id,
		position: criterion.position,
		name: criterion.name,
		description: criterion.description,
		points: criterion.points,
		expectedCodeOutput: criterion.expectedCodeOutput,
	})),
	totalPoints: rubric.criteria.reduce(
		(total, criterion) => total + criterion.points,
		0,
	),
	assignmentPoints,
	autogradeWithRubric,
	updatedAt: rubric.updatedAt.toISOString(),
	createdAt: rubric.createdAt.toISOString(),
});

const normalizeOutputLines = (output: string) => {
	const lines = output.replace(/\r/g, "").split("\n");

	if (lines.at(-1) === "") {
		lines.pop();
	}

	return lines;
};

const scoreRubricOutput = (
	criteria: Array<{ points: number; expectedCodeOutput: string | null }>,
	stdout: string,
) => {
	const actualLines = normalizeOutputLines(stdout);
	let cursor = 0;
	let score = 0;

	for (const criterion of criteria) {
		const expectedLines = normalizeOutputLines(
			criterion.expectedCodeOutput ?? "",
		);
		const actualSlice = actualLines.slice(
			cursor,
			cursor + expectedLines.length,
		);

		const matches =
			actualSlice.length === expectedLines.length &&
			expectedLines.every(
				(expectedLine, index) =>
					expectedLine.trimEnd() === (actualSlice[index] ?? "").trimEnd(),
			);

		if (matches) {
			score += criterion.points;
		}

		cursor += expectedLines.length;
	}

	return score;
};

type SubmissionKind = "individual" | "group";

const getSubmissionPathPrefix = (
	kind: SubmissionKind,
	assignmentId: number,
	submissionId: string,
) =>
	`assignments/${assignmentId}/${kind === "group" ? "group-submissions" : "submissions"}/${submissionId}/`;

async function loadSubmissionFilesById(
	ctx: {
		class: { githubRepo: string };
		classOwnerGithub: {
			request: (...args: Array<unknown>) => Promise<{ data: unknown }>;
		};
	},
	assignmentId: number,
	submissionId: string,
	kind: SubmissionKind = "individual",
) {
	const { owner, repo, defaultBranch } = await getClassOwnerRepoInfo(ctx);
	const branchResponse = (await ctx.classOwnerGithub.request(
		"GET /repos/{owner}/{repo}/branches/{branch}",
		{ owner, repo, branch: defaultBranch },
	)) as { data: { commit: { sha: string } } };

	const treeResponse = (await ctx.classOwnerGithub.request(
		"GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
		{
			owner,
			repo,
			tree_sha: branchResponse.data.commit.sha,
			recursive: "1",
		},
	)) as {
		data: { tree: Array<{ type?: string | null; path?: string | null }> };
	};

	const submissionPrefix = getSubmissionPathPrefix(
		kind,
		assignmentId,
		submissionId,
	);
	const treeItems = treeResponse.data.tree as Array<{
		type?: string | null;
		path?: string | null;
	}>;

	const submissionPaths = treeItems
		.filter(
			(treeItem) =>
				treeItem.type === "blob" &&
				typeof treeItem.path === "string" &&
				treeItem.path.startsWith(submissionPrefix),
		)
		.map((treeItem) => treeItem.path as string);

	const files = await Promise.all(
		submissionPaths.map(async (path) => {
			const fileResponse = (await ctx.classOwnerGithub.request(
				"GET /repos/{owner}/{repo}/contents/{path}",
				{ owner, repo, path },
			)) as {
				data: { content: string } | Array<unknown>;
			};

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

	return files;
}
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
					submissionMode: true,
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

			const submissionKind: SubmissionKind =
				assignment.submissionMode === "GROUP" ? "group" : "individual";

			if (submissionKind === "individual") {
				const individualSubmission = await ctx.db.submission.findUnique({
					where: {
						assignmentId_studentId: {
							assignmentId: input.assignmentId,
							studentId: ctx.session.user.id,
						},
					},
					select: { id: true, submittedAt: true, grade: true, ref: true },
				});

				if (!individualSubmission) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Submission workspace was not found for this assignment.",
					});
				}

				const files = await loadSubmissionFilesById(
					ctx,
					input.assignmentId,
					individualSubmission.id,
					submissionKind,
				);

				return { submissionKind, submission: individualSubmission, files };
			}

			const groupMembership = await ctx.db.groupMember.findFirst({
				where: { classId: ctx.class.id, studentId: ctx.session.user.id },
				select: { groupId: true, group: { select: { id: true, name: true } } },
			});

			if (!groupMembership) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						"You need to be assigned to a group before accessing this assignment.",
				});
			}

			const groupSubmission = await ctx.db.groupSubmission.findUnique({
				where: {
					assignmentId_groupId: {
						assignmentId: input.assignmentId,
						groupId: groupMembership.groupId,
					},
				},
				select: {
					id: true,
					submittedAt: true,
					grade: true,
					ref: true,
					groupId: true,
				},
			});

			if (!groupSubmission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						"Group submission workspace was not found for this assignment.",
				});
			}

			const files = await loadSubmissionFilesById(
				ctx,
				input.assignmentId,
				groupSubmission.id,
				submissionKind,
			);

			return {
				submissionKind,
				submission: groupSubmission,
				group: groupMembership.group,
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
					submissionMode: true,
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

			const submissionKind: SubmissionKind =
				assignment.submissionMode === "GROUP" ? "group" : "individual";

			const { owner, repo, defaultBranch } = await getClassOwnerRepoInfo(ctx);

			const branchResponse = await ctx.classOwnerGithub.request(
				"GET /repos/{owner}/{repo}/branches/{branch}",
				{ owner, repo, branch: defaultBranch },
			);

			const treeResponse = await ctx.classOwnerGithub.request(
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

			const studentGitHubProfile =
				await ctx.classOwnerGithub.request("GET /user");
			const authorLogin = studentGitHubProfile.data.login;
			const authorName =
				studentGitHubProfile.data.name ?? authorLogin ?? ctx.session.user.name;
			const authorEmail =
				studentGitHubProfile.data.email ??
				(authorLogin
					? `${authorLogin}@users.noreply.github.com`
					: `${ctx.session.user.id}@users.noreply.github.com`);

			if (submissionKind === "individual") {
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

				const files = Object.fromEntries(
					sanitizedFiles.map((file) => [
						`${getSubmissionPathPrefix(submissionKind, input.assignmentId, submission.id)}${file.path}`,
						file.content,
					]),
				);

				const commitResult = await ctx.classOwnerGithub.createOrUpdateFiles({
					owner,
					repo,
					branch: defaultBranch,
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
					submissionKind,
				};
			}

			const groupMembership = await ctx.db.groupMember.findFirst({
				where: {
					classId: ctx.class.id,
					studentId: ctx.session.user.id,
				},
				select: {
					groupId: true,
				},
			});

			if (!groupMembership) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						"You need to be assigned to a group before updating this assignment.",
				});
			}

			const groupSubmission = await ctx.db.groupSubmission.findUnique({
				where: {
					assignmentId_groupId: {
						assignmentId: input.assignmentId,
						groupId: groupMembership.groupId,
					},
				},
				select: {
					id: true,
				},
			});

			if (!groupSubmission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						"Group submission workspace was not found for this assignment.",
				});
			}

			const files = Object.fromEntries(
				sanitizedFiles.map((file) => [
					`${getSubmissionPathPrefix(submissionKind, input.assignmentId, groupSubmission.id)}${file.path}`,
					file.content,
				]),
			);

			const commitResult = await ctx.classOwnerGithub.createOrUpdateFiles({
				owner,
				repo,
				branch: defaultBranch,
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

			const updatedSubmission = await ctx.db.groupSubmission.update({
				where: {
					id: groupSubmission.id,
				},
				data: {
					ref: latestCommitSha,
				},
			});

			return {
				submission: updatedSubmission,
				commitSha: latestCommitSha,
				submissionKind,
			};
		}),

	getSubmissionsForAssignment: assignmentsProtectedProcedure
		.input(z.object({ assignmentId: z.number().int().positive() }))
		.query(async ({ input, ctx }) => {
			ensureTeacherRole(ctx.membership.role);

			const assignment = await ctx.db.assignment.findFirst({
				where: { id: input.assignmentId, classId: ctx.class.id },
				select: { id: true, submissionMode: true },
			});

			if (!assignment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Assignment not found.",
				});
			}

			if (assignment.submissionMode === "GROUP") {
				const groupSubs = await ctx.db.groupSubmission.findMany({
					where: {
						assignmentId: input.assignmentId,
						assignment: { classId: ctx.class.id },
					},
					include: {
						group: { include: { members: { include: { student: true } } } },
					},
					orderBy: { submittedAt: "desc" },
				});

				return groupSubs.map((s) => ({
					id: s.id,
					ref: s.ref,
					submittedAt: s.submittedAt,
					grade: s.grade,
					student: { name: s.group.name },
					studentId: s.group.id,
					group: s.group,
					submissionKind: "group" as const,
				}));
			}

			const submissions = await ctx.db.submission.findMany({
				where: {
					assignmentId: input.assignmentId,
					assignment: { classId: ctx.class.id },
				},
				include: { student: true },
				orderBy: { submittedAt: "desc" },
			});

			return submissions.map((s) => ({
				...s,
				submissionKind: "individual" as const,
			}));
		}),

	getSubmissionFiles: assignmentsProtectedProcedure
		.input(z.object({ submissionId: z.string().trim().min(1) }))
		.query(async ({ input, ctx }) => {
			ensureTeacherRole(ctx.membership.role);

			// Try individual submission first
			const submission = await ctx.db.submission.findFirst({
				where: { id: input.submissionId },
				select: {
					id: true,
					ref: true,
					submittedAt: true,
					grade: true,
					assignmentId: true,
				},
			});

			if (submission) {
				const files = await loadSubmissionFilesById(
					ctx,
					submission.assignmentId,
					submission.id,
					"individual",
				);

				return { submission, files };
			}

			// Try group submission
			const groupSubmission = await ctx.db.groupSubmission.findFirst({
				where: { id: input.submissionId },
				select: {
					id: true,
					ref: true,
					submittedAt: true,
					grade: true,
					assignmentId: true,
					groupId: true,
				},
			});

			if (!groupSubmission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission not found.",
				});
			}

			const files = await loadSubmissionFilesById(
				ctx,
				groupSubmission.assignmentId,
				groupSubmission.id,
				"group",
			);

			return { submission: groupSubmission, files };
		}),

	getMyAssignmentSubmission: assignmentsProtectedProcedure.query(
		async ({ input, ctx }) => {
			ensureStudentRole(ctx.membership.role);

			const assignment = await ctx.db.assignment.findFirst({
				where: {
					id: input.assignmentId,
					classId: ctx.class.id,
				},
				select: {
					id: true,
					points: true,
					published: true,
					submissionMode: true,
				},
			});

			if (!assignment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Assignment not found.",
				});
			}

			const submissionKind: SubmissionKind =
				assignment.submissionMode === "GROUP" ? "group" : "individual";

			if (submissionKind === "individual") {
				const individualSubmission = await ctx.db.submission.findUnique({
					where: {
						assignmentId_studentId: {
							assignmentId: input.assignmentId,
							studentId: ctx.session.user.id,
						},
					},
					select: { id: true, ref: true, submittedAt: true, grade: true },
				});

				return { assignment, submission: individualSubmission, submissionKind };
			}

			const groupMembership = await ctx.db.groupMember.findFirst({
				where: { classId: ctx.class.id, studentId: ctx.session.user.id },
				select: { groupId: true, group: { select: { id: true, name: true } } },
			});

			if (!groupMembership) {
				return { assignment, submission: null, submissionKind };
			}

			const groupSubmission = await ctx.db.groupSubmission.findUnique({
				where: {
					assignmentId_groupId: {
						assignmentId: input.assignmentId,
						groupId: groupMembership.groupId,
					},
				},
				select: {
					id: true,
					ref: true,
					submittedAt: true,
					grade: true,
					groupId: true,
				},
			});

			return { assignment, submission: groupSubmission, submissionKind };
		},
	),

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
					submissionMode: true,
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

			const submissionKind: SubmissionKind =
				assignment.submissionMode === "GROUP" ? "group" : "individual";

			let individualSubmissionId: string | null = null;
			let groupId: string | null = null;

			if (submissionKind === "individual") {
				const individualSubmission = await ctx.db.submission.findUnique({
					where: {
						assignmentId_studentId: {
							assignmentId: input.assignmentId,
							studentId: ctx.session.user.id,
						},
					},
					select: { id: true },
				});

				if (!individualSubmission) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Submission workspace was not found for this assignment.",
					});
				}

				individualSubmissionId = individualSubmission.id;
			} else {
				const groupMember = await ctx.db.groupMember.findFirst({
					where: { classId: ctx.class.id, studentId: ctx.session.user.id },
					select: { groupId: true },
				});

				if (!groupMember) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Submission workspace was not found for this assignment.",
					});
				}

				groupId = groupMember.groupId;
			}

			const submissionId =
				submissionKind === "individual" ? individualSubmissionId! : groupId!;

			const autogradeAssignment = await ctx.db.assignment.findFirst({
				where: {
					id: input.assignmentId,
					classId: ctx.class.id,
				},
				select: {
					id: true,
					points: true,
					autogradeWithRubric: true,
					rubric: {
						include: {
							criteria: {
								orderBy: {
									position: "asc",
								},
							},
						},
					},
				},
			});

			if (!autogradeAssignment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Assignment not found.",
				});
			}

			let autogradeResult: { grade?: number } | null = null;

			if (
				autogradeAssignment.autogradeWithRubric &&
				autogradeAssignment.rubric &&
				hasExpectedCodeOutput(autogradeAssignment.rubric.criteria)
			) {
				const files = await loadSubmissionFilesById(
					ctx,
					input.assignmentId,
					submissionId,
					submissionKind,
				);

				const executionResult = await runJavaCode(
					files.map((file) => ({
						name: file.path,
						content: file.content,
					})),
				);

				const stdout =
					executionResult.run?.stdout ?? executionResult.run?.output ?? "";
				autogradeResult = {
					grade: scoreRubricOutput(autogradeAssignment.rubric.criteria, stdout),
				};
			}

			if (submissionKind === "individual") {
				return await ctx.db.submission.update({
					where: { id: individualSubmissionId! },
					data: {
						submittedAt: new Date(),
						grade: autogradeResult?.grade ?? undefined,
					},
				});
			}

			return await ctx.db.groupSubmission.update({
				where: {
					assignmentId_groupId: {
						assignmentId: input.assignmentId,
						groupId: groupId!,
					},
				},
				data: {
					submittedAt: new Date(),
					grade: autogradeResult?.grade ?? undefined,
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
				assignmentId: z.number().int().positive(),
				submissionId: z.string().trim().min(1, "Submission ID is required."),
			}),
		)
		.query(async ({ input, ctx }) => {
			ensureTeacherRole(ctx.membership.role);

			// Try individual submission
			const submission = await ctx.db.submission.findFirst({
				where: {
					id: input.submissionId,
					assignmentId: input.assignmentId,
					assignment: { classId: ctx.class.id },
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
					assignment: { select: { id: true, name: true, points: true } },
				},
			});

			if (submission) return submission;

			// Try group submission
			const groupSubmission = await ctx.db.groupSubmission.findFirst({
				where: {
					id: input.submissionId,
					assignmentId: input.assignmentId,
					assignment: { classId: ctx.class.id },
				},
				include: {
					group: {
						include: {
							members: {
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
							},
						},
					},
					assignment: { select: { id: true, name: true, points: true } },
				},
			});

			if (!groupSubmission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission not found for this assignment.",
				});
			}

			return groupSubmission;
		}),

	gradeAssignmentSubmission: assignmentsProtectedProcedure
		.input(
			z.object({
				assignmentId: z.number().int().positive(),
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

			// Try updating individual submission first
			const existingSubmission = await ctx.db.submission.findFirst({
				where: {
					id: input.submissionId,
					assignmentId: input.assignmentId,
					assignment: { classId: ctx.class.id },
				},
				select: { id: true },
			});

			if (existingSubmission) {
				return await ctx.db.submission.update({
					where: { id: input.submissionId },
					data: { grade: input.grade },
				});
			}

			// Try group submission
			const existingGroupSubmission = await ctx.db.groupSubmission.findFirst({
				where: {
					id: input.submissionId,
					assignmentId: input.assignmentId,
					assignment: { classId: ctx.class.id },
				},
				select: { id: true },
			});

			if (!existingGroupSubmission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission not found for this assignment.",
				});
			}

			return await ctx.db.groupSubmission.update({
				where: { id: input.submissionId },
				data: { grade: input.grade },
			});
		}),

	getAssignmentRubric: assignmentsProtectedProcedure.query(
		async ({ input, ctx }) => {
			const assignment = await ctx.db.assignment.findFirst({
				where: {
					id: input.assignmentId,
					classId: ctx.class.id,
				},
				select: {
					id: true,
					points: true,
					autogradeWithRubric: true,
				},
			});

			if (!assignment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Assignment not found.",
				});
			}

			const rubric = await ctx.db.rubric.findUnique({
				where: {
					assignmentId: assignment.id,
				},
				include: {
					criteria: {
						orderBy: {
							position: "asc",
						},
					},
				},
			});

			return {
				rubric: rubric
					? mapRubric(rubric, assignment.points, assignment.autogradeWithRubric)
					: null,
			};
		},
	),

	upsertAssignmentRubric: assignmentsProtectedProcedure
		.input(
			z.object({
				title: z.string().trim().min(1, "Rubric title is required."),
				autogradeWithRubric: z.boolean().optional(),
				criteria: z.array(
					z.object({
						name: z.string().trim().min(1, "Criterion name is required."),
						description: z.string().trim().optional(),
						points: z.number().min(0, "Criterion points must be 0 or greater."),
						expectedCodeOutput: z.string().trim().optional(),
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
					autogradeWithRubric: true,
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

			const autogradeWithRubric =
				input.autogradeWithRubric ?? assignment.autogradeWithRubric;

			if (autogradeWithRubric && !hasExpectedCodeOutput(input.criteria)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"All rubric criteria must define expected code output before autograding can be enabled.",
				});
			}

			const rubric = await ctx.db.$transaction(async (tx) => {
				const savedRubric = await tx.rubric.upsert({
					where: {
						assignmentId: assignment.id,
					},
					create: {
						assignmentId: assignment.id,
						title: input.title,
						criteria: {
							create: input.criteria.map((criterion, position) => ({
								position,
								name: criterion.name,
								description: criterion.description,
								points: criterion.points,
								expectedCodeOutput: criterion.expectedCodeOutput,
							})),
						},
					},
					update: {
						title: input.title,
						criteria: {
							deleteMany: {},
							create: input.criteria.map((criterion, position) => ({
								position,
								name: criterion.name,
								description: criterion.description,
								points: criterion.points,
								expectedCodeOutput: criterion.expectedCodeOutput,
							})),
						},
					},
					include: {
						criteria: {
							orderBy: {
								position: "asc",
							},
						},
					},
				});

				await tx.assignment.update({
					where: {
						id: assignment.id,
					},
					data: {
						autogradeWithRubric,
					},
				});

				return savedRubric;
			});

			return {
				rubric: mapRubric(rubric, assignment.points, autogradeWithRubric),
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
					const existingFile = await ctx.classOwnerGithub.request(
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
			await ctx.classOwnerGithub.request(
				"PUT /repos/{owner}/{repo}/contents/{path}",
				{
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
				},
			);

			const gitkeepPath = `assignments/${newAssignment.id}/sourcefiles/.gitkeep`;
			const gitkeepSha = await getFileSha(gitkeepPath);

			// Create .gitkeep in sourcefiles folder
			await ctx.classOwnerGithub.request(
				"PUT /repos/{owner}/{repo}/contents/{path}",
				{
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
				},
			);

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

		const response = await ctx.classOwnerGithub.request(
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

			const { owner, repo, defaultBranch } = await getClassOwnerRepoInfo(ctx);

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

			const branchResponse = await ctx.classOwnerGithub.request(
				"GET /repos/{owner}/{repo}/branches/{branch}",
				{
					owner,
					repo,
					branch: defaultBranch,
				},
			);

			const treeResponse = await ctx.classOwnerGithub.request(
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
					const contentResponse = await ctx.classOwnerGithub.request(
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

			const commitResult = await ctx.classOwnerGithub.createOrUpdateFiles({
				owner,
				repo,
				branch: defaultBranch,
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

	feedback: feedbackRouter,
});
