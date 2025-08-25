import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import type { AppType } from "next/app";
import { Geist } from "next/font/google";
import Header from "~/components/header";

import { api } from "~/utils/api";

import "~/styles/globals.css";
import { Toaster } from "sonner";

const geist = Geist({
	subsets: ["latin"],
});

const MyApp: AppType<{ session: Session | null }> = ({
	Component,
	pageProps: { session, ...pageProps },
}) => {
	return (
		<SessionProvider session={session}>
			<div className={`mx-auto ${geist.className}`}>
				<main className="min-h-[100dvh] bg-background font-sans">
					<Header />
					<Component {...pageProps} session={session} />
				</main>
				{/* <Footer /> */}
			</div>
			<Toaster />
		</SessionProvider>
	);
};

export default api.withTRPC(MyApp);
