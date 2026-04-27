import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { classProtectedProcedure, createTRPCRouter } from "~/server/api/trpc";

const ensureTeacherRole = (role: "OWNER" | "TEACHER" | "STUDENT") => {
	if (role === "STUDENT") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only teachers can perform this action.",
		});
	}
};

const shuffleArray = <T>(items: T[]) => {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = result[i];
		result[i] = result[j] as T;
		result[j] = temp as T;
	}
	return result;
};

export const groupsRouter = createTRPCRouter({
	getGroups: classProtectedProcedure.query(async ({ ctx }) => {
		ensureTeacherRole(ctx.membership.role);

		return await ctx.db.group.findMany({
			where: {
				classId: ctx.class.id,
			},
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
					orderBy: {
						student: {
							name: "asc",
						},
					},
				},
			},
			orderBy: {
				name: "asc",
			},
		});
	}),

	createGroup: classProtectedProcedure
		.input(
			z.object({
				name: z.string().trim().min(1, "Group name is required."),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			ensureTeacherRole(ctx.membership.role);

			return await ctx.db.group.create({
				data: {
					classId: ctx.class.id,
					name: input.name,
				},
			});
		}),

	assignStudentsToGroup: classProtectedProcedure
		.input(
			z.object({
				groupId: z.string().trim().min(1, "Group ID is required."),
				studentIds: z
					.array(z.string().trim().min(1, "Student ID is required."))
					.min(1, "At least one student is required."),
				replaceExisting: z.boolean().default(true),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			ensureTeacherRole(ctx.membership.role);

			const group = await ctx.db.group.findFirst({
				where: {
					id: input.groupId,
					classId: ctx.class.id,
				},
				select: {
					id: true,
				},
			});

			if (!group) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Group not found for this class.",
				});
			}

			const studentsInClass = await ctx.db.classMembership.findMany({
				where: {
					classId: ctx.class.id,
					role: "STUDENT",
					userId: {
						in: input.studentIds,
					},
				},
				select: {
					userId: true,
				},
			});

			if (studentsInClass.length !== input.studentIds.length) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "One or more students are not in this class.",
				});
			}

			await ctx.db.$transaction(async (tx) => {
				if (input.replaceExisting) {
					await tx.groupMember.deleteMany({
						where: {
							classId: ctx.class.id,
							studentId: {
								in: input.studentIds,
							},
						},
					});
				}

				await tx.groupMember.createMany({
					data: input.studentIds.map((studentId) => ({
						classId: ctx.class.id,
						groupId: input.groupId,
						studentId,
					})),
					skipDuplicates: true,
				});
			});

			return await ctx.db.group.findUnique({
				where: {
					id: input.groupId,
				},
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
						orderBy: {
							student: {
								name: "asc",
							},
						},
					},
				},
			});
		}),

	autoCreateAndAssignGroups: classProtectedProcedure
		.input(
			z.object({
				groupSize: z
					.number()
					.int()
					.min(2, "Group size must be at least 2."),
				groupNamePrefix: z.string().trim().min(1).default("Group"),
				studentIds: z.array(z.string().trim().min(1)).optional(),
				replaceExisting: z.boolean().default(true),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			ensureTeacherRole(ctx.membership.role);

			const classStudents = await ctx.db.classMembership.findMany({
				where: {
					classId: ctx.class.id,
					role: "STUDENT",
					...(input.studentIds
						? {
							userId: {
								in: input.studentIds,
							},
						}
						: {}),
				},
				select: {
					userId: true,
				},
			});

			if (classStudents.length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No students found to assign.",
				});
			}

			if (input.studentIds && classStudents.length !== input.studentIds.length) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "One or more selected students are not in this class.",
				});
			}

			const shuffledStudentIds = shuffleArray(classStudents.map((item) => item.userId));
			const studentChunks: string[][] = [];

			for (let i = 0; i < shuffledStudentIds.length; i += input.groupSize) {
				studentChunks.push(shuffledStudentIds.slice(i, i + input.groupSize));
			}

			const baseIndex = await ctx.db.group.count({
				where: {
					classId: ctx.class.id,
				},
			});

			const result = await ctx.db.$transaction(async (tx) => {
				if (input.replaceExisting) {
					await tx.groupMember.deleteMany({
						where: {
							classId: ctx.class.id,
							studentId: {
								in: shuffledStudentIds,
							},
						},
					});
				}

				const createdGroups = [];
				for (const [index, studentIds] of studentChunks.entries()) {
					const group = await tx.group.create({
						data: {
							classId: ctx.class.id,
							name: `${input.groupNamePrefix} ${baseIndex + index + 1}`,
						},
					});

					await tx.groupMember.createMany({
						data: studentIds.map((studentId) => ({
							classId: ctx.class.id,
							groupId: group.id,
							studentId,
						})),
					});

					createdGroups.push({
						...group,
						memberCount: studentIds.length,
					});
				}

				return createdGroups;
			});

			return {
				groupsCreated: result.length,
				studentsAssigned: shuffledStudentIds.length,
				groups: result,
			};
		}),
});
