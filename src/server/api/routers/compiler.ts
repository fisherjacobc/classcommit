import { TRPCError } from "@trpc/server";
import z from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export type JavaSourceFile = {
	name: string;
	content: string;
};

export type JavaExecutionResult = {
	language?: string;
	version?: string;
	run?: {
		stdout?: string;
		stderr?: string;
		output?: string;
		code?: number | null;
		signal?: string | null;
		message?: string | null;
	};
	compile?: {
		stdout?: string;
		stderr?: string;
		output?: string;
		code?: number | null;
		signal?: string | null;
		message?: string | null;
	};
	message?: string;
};

export async function runJavaCode(files: JavaSourceFile[]) {
	const normalizedFiles = files.map((file) => ({
		name:
			file.name
				.split(/[/\\]/)
				.at(-1)
				?.replace(/\.java$/i, "") ?? file.name,
		content: file.content,
	}));

	const response = await fetch("https://piston.fishrlab.net/api/v2/execute", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			language: "java",
			version: "15.0.2",
			files: normalizedFiles,
			stdin: "",
		}),
	});

	if (!response.ok) {
		throw new TRPCError({
			code: "BAD_GATEWAY",
			message: "Unable to run code right now.",
		});
	}

	return (await response.json()) as JavaExecutionResult;
}

export const compilerRouter = createTRPCRouter({
	runCode: protectedProcedure
		.input(
			z.object({
				files: z.array(
					z.object({
						name: z.string().min(1),
						content: z.string(),
					}),
				),
			}),
		)
		.mutation(async ({ input }) => {
			const result = await runJavaCode(input.files);

			return {
				output:
					result.run?.output ??
					result.compile?.output ??
					result.message ??
					"No output returned.",
			};
		}),
});

export default compilerRouter;
