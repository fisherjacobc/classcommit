import { unauthorized, } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { getSession } from "~/server/better-auth/server";
import { api } from "~/trpc/server";
import ClassSidebar from "./sidebar";
import "~/styles/globals.css";

import type { Class } from "generated/prisma";
import { Geist } from "next/font/google";
import { ThemeProvider } from "~/components/theme-provider";
import { Separator } from "~/components/ui/separator";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
import { TRPCReactProvider } from "~/trpc/react";
import Breadcrumbs from "./breadcrumbs";

const geist = Geist({
    subsets: ["latin"],
    variable: "--font-geist-sans",
});

function Header({ classData }: { classData: Class }) {
    return (
        <header className="flex shrink-0 items-center gap-2 border-b p-2 transition-[width,height] ease-linear">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                />
                <Breadcrumbs classData={classData} />
            </div>
        </header>
    )
}

export default async function RootLayout({
    children,
    params
}: Readonly<{ children: React.ReactNode, params: Promise<{ classId: string }> }>) {
    const session = await getSession();

    if (!session)
        unauthorized();

    const classId = Number.parseInt((await params).classId, 10)

    await api.classes.getClass.prefetch({ classId });
    await api.assignments.getAssignments.prefetch({ classId });

    const classData = await api.classes.getClass({ classId });
    const assignmentsData = await api.assignments.getAssignments({ classId })

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
                            <SidebarProvider>
                                <ClassSidebar session={session} classData={classData} assignmentsData={assignmentsData} />
                                <SidebarInset className="gap-y-4">
                                    <Header classData={classData} />
                                    {children}
                                </SidebarInset>
                            </SidebarProvider>
                            <Toaster position="top-center" />
                        </TooltipProvider>
                    </ThemeProvider>
                </TRPCReactProvider>
            </body>
        </html>
    );
}

export async function generateMetadata({ params }: { params: Promise<{ classId: string }> }) {
    const { classId } = await params;

    const classData = await api.classes.getClass({ classId: Number.parseInt(classId, 10) });

    return {
        title: classData.name,
        description: "A web-based application that brings the power of GitHub into programming classrooms.",
        icons: [{ rel: "icon", url: "/favicon.ico" }],
    }
}
