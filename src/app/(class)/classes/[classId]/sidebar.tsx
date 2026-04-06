"use client";
import type { Assignment, Class } from "generated/prisma";
import { EllipsisVertical, Files, LogOutIcon, SchoolIcon, Settings, UserIcon, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "~/components/ui/sidebar";
import { formatDate } from "~/lib/utils";
import { authClient } from "~/server/better-auth/client";
import type { SessionProp } from "~/server/better-auth/server";

interface ClassSidebarProps {
    session: NonNullable<SessionProp>;
    classData: Class
    assignmentsData: Assignment[];
}

function SidebarNav({ classData }: { classData: Class }) {
    const hrefBase = `/classes/${classData.id}`;

    return (
        <SidebarGroup>
            <SidebarGroupContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <Link href={`${hrefBase}/people`}>
                            <SidebarMenuButton tooltip="People" className="hover:cursor-pointer">
                                <Users />
                                <span>People</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href={`${hrefBase}/assignments`}>
                            <SidebarMenuButton tooltip="Assignments" className="hover:cursor-pointer">
                                <Files />
                                <span>Assignments</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href={`${hrefBase}/settings`}>
                            <SidebarMenuButton tooltip="Settings" className="hover:cursor-pointer">
                                <Settings />
                                <span>Settings</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}

function SidebarAssignments({ classData, assignmentsData }: {
    classData: Class
    assignmentsData: Assignment[];
}) {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>To-Do</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {assignmentsData.map(assignment => <SidebarMenuItem key={assignment.id}>
                        <Link href={`/classes/${classData.id}/assignments/${assignment.id}`}>
                            <SidebarMenuButton tooltip={assignment.name} className="hover:cursor-pointer" size="lg">
                                <div className="flex flex-col">
                                    <span className="font-medium">{assignment.name}</span>
                                    <span className="text-slate-600 text-xs dark:text-slate-400">{assignment.points} points {assignment.dueDate && `| ${formatDate(assignment.dueDate)}`}</span>
                                </div>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>)}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}

function SidebarUser({ session: { user } }: { session: NonNullable<SessionProp> }) {
    const router = useRouter();
    const { isMobile } = useSidebar();

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <Avatar className="h-8 w-8 rounded-lg grayscale">
                                {/* @ts-ignore */}
                                <AvatarImage src={user.image} alt={user.name} />
                                <AvatarFallback className="rounded-lg">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{user.name}</span>
                                <span className="truncate text-muted-foreground text-xs">
                                    @{user.handle}
                                </span>
                            </div>
                            <EllipsisVertical className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                <Avatar className="h-8 w-8 rounded-lg">
                                    {/* @ts-ignore */}
                                    <AvatarImage src={user.image} alt={user.name} />
                                    <AvatarFallback className="rounded-lg">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">{user.name}</span>
                                    <span className="truncate text-muted-foreground text-xs">
                                        @{user.handle}
                                    </span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem>
                                <Link href="/account" className="flex w-full gap-2">
                                    <UserIcon />
                                    Account
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Link href="/classes" className="flex w-full gap-2">
                                    <SchoolIcon />
                                    Classes
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-500 hover:cursor-pointer" onClick={() => {
                            authClient.signOut({
                                fetchOptions: {
                                    onSuccess: () => {
                                        router.push("/", {});
                                        router.refresh();
                                    },
                                },
                            });
                        }}>
                            <LogOutIcon />
                            Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}

export default function ClassSidebar({ session, classData, assignmentsData }: ClassSidebarProps) {
    const [_scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const scrollHandler = () => {
            setScrolled(window.scrollY > 0);
        };

        window.addEventListener("scroll", scrollHandler);
        return () => {
            window.removeEventListener("scroll", scrollHandler);
        };
    }, []);


    return (
        <Sidebar collapsible="icon" variant="inset" side="left">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <Link href={`/classes/${classData.id}`} className="font-bold text-xl">{classData.name}</Link>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarNav classData={classData} />
                <SidebarAssignments classData={classData} assignmentsData={assignmentsData} />
            </SidebarContent>
            <SidebarFooter>
                <SidebarUser session={session} />
            </SidebarFooter>
        </Sidebar>
    )
}