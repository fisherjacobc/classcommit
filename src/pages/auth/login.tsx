import { getServerSessionProps } from "~/server/auth";
import type { GetServerSidePropsContext } from "next";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function Login() {
	const callbackUrl = useSearchParams()?.get("callbackUrl") ?? undefined;
	return void signIn("github", { callbackUrl: callbackUrl ?? "/classes" });
}

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
	const {
		props: { session },
	} = await getServerSessionProps(ctx);

	if (session) {
		return { redirect: { destination: "/" } };
	}

	return { props: {} };
};
