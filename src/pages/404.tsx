export default function Page404() {
    return (
        <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-24 sm:py-32 lg:px-8">
            <div className="text-center">
                <p className="font-semibold text-base text-indigo-400">404</p>
                <h1 className="mt-4 text-balance font-semibold text-5xl text-slate-900 tracking-tight sm:text-7xl">Page not found</h1>
                <p className="mt-6 text-pretty font-medium text-lg text-slate-700 sm:text-xl/8">Sorry, we couldn&apos;t find the page you&apos;re looking for.</p>
                <div className="mt-10 flex items-center justify-center gap-x-6">
                <a href="/" className="rounded-md bg-indigo-500 px-3.5 py-2.5 font-semibold text-sm text-white shadow-xs hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2">Go back home</a>
                </div>
            </div>
        </main>
    )
}