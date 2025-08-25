import { signOut } from "next-auth/react";

export default function Logout() {
	return void signOut({ callbackUrl: "/" });
}
