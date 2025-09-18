import type { GetServerSidePropsContext } from "next";
import { postRouter } from "~/server/api/routers/post";
import {
	createCallerFactory,
	createTRPCRouter,
	createTRPCContext,
} from "~/server/api/trpc";
import { createServerSideHelpers } from "@trpc/react-query/server";
import superjson from "superjson";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	post: postRouter,
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

export const serverSideApi = async (ctx: GetServerSidePropsContext) => {
	return createServerSideHelpers({
		router: appRouter,
		//@ts-expect-error Incompatible type, however still fully works!
		ctx: await createTRPCContext(ctx),
		transformer: superjson,
	});
};
