import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { assignmentsRouter } from "./routers/assignments";
import { classesRouter } from "./routers/classes";
import { githubRouter } from "./routers/github";
import { groupsRouter } from "./routers/groups";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	classes: classesRouter,
	assignments: assignmentsRouter,
	github: githubRouter,
	groups: groupsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
