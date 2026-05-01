
import Link from "next/link";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
	return (
		<HydrateClient>
			<main className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-[#1f2a44] to-[#0f172a] text-white">
				<div className="container mx-auto flex max-w-5xl flex-col items-center gap-y-10 px-6 py-20">
					<div className="text-center">
						<p className="mb-4 inline-flex rounded-full bg-white/10 px-4 py-1 font-medium text-blue-200 text-sm">
							Built for programming classrooms
						</p>
						<h1 className="font-extrabold text-5xl tracking-tight sm:text-6xl">
							Class<span className="text-[hsl(214,100%,70%)]">Commit</span>
						</h1>
						<p className="mx-auto mt-5 max-w-2xl text-lg text-slate-200">
							A web platform that helps students write code, track progress with GitHub,
							and get faster, clearer feedback from teachers.
						</p>
					</div>

					<div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
						<div className="rounded-md bg-white/10 p-6 backdrop-blur-sm">
							<h2 className="mb-4 font-semibold text-2xl">What students can do</h2>
							<ul className="list-disc space-y-2 pl-5 text-slate-100">
								<li>Sign in with GitHub and join classes with a class code</li>
								<li>Work in a built-in code editor with local auto-save</li>
								<li>Submit assignment work through GitHub pull requests</li>
								<li>Participate in peer reviews when enabled</li>
							</ul>
						</div>

						<div className="rounded-md bg-white/10 p-6 backdrop-blur-sm">
							<h2 className="mb-4 font-semibold text-2xl">What teachers can do</h2>
							<ul className="list-disc space-y-2 pl-5 text-slate-100">
								<li>Create classes, assignments, docs, and starter code</li>
								<li>Review code inline and leave rubric-based feedback</li>
								<li>Track commits, contribution history, and assignment progress</li>
								<li>Support both individual and group assignments</li>
							</ul>
						</div>
					</div>

					<div className="flex flex-wrap items-center justify-center gap-4">
						<Link
							className="rounded-full bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-slate-200"
							href="https://github.com/fisherjacobc/classcommit"
							target="_blank"
						>
							View on GitHub
						</Link>
						<Link
							className="rounded-full bg-white/10 px-6 py-3 font-semibold text-white transition hover:bg-white/20"
							href="https://github.com/fisherjacobc/classcommit#readme"
							target="_blank"
						>
							Read Project Proposal
						</Link>
					</div>
				</div>
			</main>
		</HydrateClient>
	);
}
