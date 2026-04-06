import { createTRPCRouter, githubProtectedProcedure } from "../trpc";

export const githubRouter = createTRPCRouter({
	getGithubProfile: githubProtectedProcedure.query(async ({ ctx }) => {
		return (
			await ctx.github.request(`GET /users/${ctx.session.user.handle}/repos`)
		).data;
	}),

	getRepos: githubProtectedProcedure.query(async ({ ctx }) => {
		return ctx.session.githubAccount.repos;
	}),
});
