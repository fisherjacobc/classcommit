"use server";
import { redirect } from "next/navigation";
import { auth } from "~/server/better-auth";

export async function login() {
	const res = await auth.api.signInSocial({
		body: {
			provider: "github",
			callbackURL: "/classes",
		},
	});
	if (!res.url) {
		throw new Error("No URL returned from signInSocial");
	}

	redirect(res.url);
}
