import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { signIn, signOut, useSession } from "next-auth/react";
import { ExternalLink, ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

function Logo() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			className="lucide lucide-school-icon lucide-school h-12 w-12"
		>
			<path d="M18 5v16" />
			<path d="m4 6 7.106-3.79a2 2 0 0 1 1.788 0L20 6" />
			<path d="m6 11-3.52 2.147a1 1 0 0 0-.48.854V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a1 1 0 0 0-.48-.853L18 11" />
			<path d="M6 5v16" />

			<line x1="10" x2="10" y1="8" y2="13" stroke-width="1" />
			<circle cx="14.25" cy="9" r="1.5" stroke-width="1" />
			<circle cx="10" cy="15" r="1.5" stroke-width="1" />
			<path d="M14.25 11 a8 6 0 0 1-3 3" stroke-width="1" />
		</svg>
	);
}

export default function Header() {
	const [scrolled, setScrolled] = useState(false);

	const router = useRouter();

	useEffect(() => {
		const scrollHandler = () => {
			setScrolled(window.scrollY > 0);
		};

		window.addEventListener("scroll", scrollHandler);
		return () => {
			window.removeEventListener("scroll", scrollHandler);
		};
	}, []);

	const { status, data: session } = useSession();
	const loading = status === "loading";

	return (
		<div
			className={`box-shadow sticky top-0 z-50 min-w-full border-slate-50 transition-[background duration-100 dark:border-slate-800 ${scrolled ? "border-b bg-slate-50/50 pt-0 shadow-md backdrop-blur-sm" : "py-2"}`}
		>
			<header className="container mx-auto flex h-16 justify-between">
				<div className="flex items-center">
					<Link
						href="/"
						className="mr-5 flex cursor-pointer items-center gap-x-3 text-slate-950 dark:text-white"
					>
						<Logo />

						<span className="font-semibold text-primary text-xl dark:text-secondary">
							ClassCommit
						</span>
					</Link>
				</div>
				<div className="flex items-center gap-x-8">
					<Link
						key="classes"
						href="/classes"
						className={`flex-shrink-0 cursor-pointer p-1 font-medium transition hover:text-primary/90 dark:hover:text-secondary/90 ${router.pathname.startsWith("/classes") ? "text-primary dark:text-secondary" : "text-primary/70 dark:text-secondary/70"}`}
					>
						Classes
					</Link>
					{session && !loading && (
						<div className="flex items-center gap-x-2">
							<Image
								src={session.user.image}
								className="h-8 w-8 rounded-full"
								width={150}
								height={150}
								alt={session.user.name ?? "User Account"}
							/>
							<span className="text-primary dark:text-secondary font-medium">
								{session.user.name}
							</span>
						</div>
					)}
					{!session && !loading && (
						<Button
							className="font-medium"
							variant="outline"
							onClick={() =>
								void signIn("github", { callbackUrl: "/classses" })
							}
						>
							Login <ExternalLink className="ml-1 h-4 w-4" />
						</Button>
					)}
					{loading && (
						<Button
							variant="ghost"
							className="flex cursor-pointer select-none items-center justify-center gap-1"
						>
							<Skeleton className="aspect-square h-10 w-10 rounded-full" />
							<Skeleton className="h-6 w-24 rounded-full" />
						</Button>
					)}
				</div>
			</header>
		</div>
	);
}
