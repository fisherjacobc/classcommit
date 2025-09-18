import type { Session } from "next-auth";
import { signIn } from "next-auth/react";
import { useEffect } from "react";

export default function requireAuth(session: Session | null) {
	useEffect(() => {
		if (!session) void signIn("roblox", { callbackUrl: "/companies" });
	}, [session]);
}
