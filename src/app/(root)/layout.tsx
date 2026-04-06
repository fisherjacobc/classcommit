import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "~/components/theme-provider";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
import { getSession } from "~/server/better-auth/server";
import { TRPCReactProvider } from "~/trpc/react";
import Navbar from "../_components/navbar";

export const metadata: Metadata = {
	title: "ClassCommit",
	description: "A web-based application that brings the power of GitHub into programming classrooms.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const session = await getSession();

	return (
		<html className={`${geist.variable}`} lang="en" suppressHydrationWarning>
			<body className="bg-background">
				<TRPCReactProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
					>
						<TooltipProvider>
							<Navbar session={session} />
							{children}
							<Toaster position="top-center" />
						</TooltipProvider>
					</ThemeProvider>
				</TRPCReactProvider>
			</body>
		</html>
	);
}
