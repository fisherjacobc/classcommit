import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";

import { authOptions } from "./config";
import type { GetServerSidePropsContext } from "next";

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = (ctx: {
	req: GetServerSidePropsContext["req"];
	res: GetServerSidePropsContext["res"];
}) => {
	return getServerSession(ctx.req, ctx.res, authOptions);
};

export type ServerSessionProps = {
	session: Session | null;
};

export const getServerSessionProps = async (ctx: {
	req: GetServerSidePropsContext["req"];
	res: GetServerSidePropsContext["res"];
}) => {
	return {
		props: {
			session: await getServerSession(ctx.req, ctx.res, authOptions),
		},
	};
};
