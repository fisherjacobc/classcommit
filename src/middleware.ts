import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/better-auth";

export async function middleware(_request: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	// THIS IS NOT SECURE!
	// This is the recommended approach to optimistically redirect users
	// We recommend handling auth checks in each page/route
	if (!session) {
		const res = await auth.api.signInSocial({
			body: {
				provider: "github",
				callbackURL: "/classes",
			},
		});

		if (!res.url) {
			throw new Error("No URL returned from signInSocial");
		}

		return NextResponse.redirect(res.url);
	}

	return NextResponse.next();
}

export const config = {
	runtime: "nodejs", // Required for auth.api calls
	matcher: ["/classes", "/classes/:path"], // Specify the routes the middleware applies to
};
