import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import type { AppType } from "next/app";
import { Lato } from "next/font/google";
import Header from "~/components/header";

import { api } from "~/utils/api";

import "~/styles/globals.css";
import { Toaster } from "sonner";
import { canvas, InstUISettingsProvider } from "@instructure/ui";

const font = Lato({
	subsets: ["latin"],
	weight: "700",
});

const MyApp: AppType<{ session: Session | null }> = ({
	Component,
	pageProps: { session, ...pageProps },
}) => {
	return (
		<SessionProvider session={session}>
			<InstUISettingsProvider theme={canvas}>
				<div className={`mx-auto ${font.className}`}>
					<main className="min-h-[100dvh] bg-background font-sans">
						<Header />
						<Component {...pageProps} session={session} />
					</main>
					{/* <Footer /> */}
				</div>
				<Toaster />
			</InstUISettingsProvider>
		</SessionProvider>
	);
};

export default api.withTRPC(MyApp);
