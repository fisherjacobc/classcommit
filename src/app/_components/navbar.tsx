"use client";

import { ChevronDown, ChevronUp, LogOutIcon, Moon, SchoolIcon, Sun, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Logo from "~/../public/classcommit.svg";
import { login, } from "~/app/(root)/actions";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, } from "~/components/ui/navigation-menu";
import { authClient } from "~/server/better-auth/client";
import type { SessionProp } from "~/server/better-auth/server";

function ThemeToggle() {
    const { setTheme } = useTheme()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild className="">
                <Button variant="outline" size="icon">
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )

}

interface UserDropdownProps {
    user: NonNullable<SessionProp>["user"];
}

function UserDropdown({ user }: UserDropdownProps) {
    const router = useRouter();
    const [_state, _setState] = useState(false);

    return <DropdownMenu>
        <DropdownMenuTrigger asChild className="group">
            <Button variant="ghost">
                <Avatar className="h-8 w-8 rounded-lg">
                    {/* @ts-ignore */}
                    <AvatarImage src={user.image} alt={user.name} />
                    <AvatarFallback className="rounded-lg">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">@{user.handle}</span>
                </div>
                <ChevronDown className="size-3 group-data-open:hidden" />
                <ChevronUp className="size-3 group-data-closed:hidden" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuItem>
                <Link href="/account" className="flex w-full gap-2">
                    <UserIcon />
                    Account
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="sm:hidden">
                <Link href="/classes" className="flex w-full gap-2">
                    <SchoolIcon />
                    Classes
                </Link>
            </DropdownMenuItem>
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
}

interface NavbarProps {
    session: SessionProp;
}

export default function Navbar({ session }: NavbarProps) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const scrollHandler = () => {
            setScrolled(window.scrollY > 0);
        };

        window.addEventListener("scroll", scrollHandler);
        return () => {
            window.removeEventListener("scroll", scrollHandler);
        };
    }, []);

    return <NavigationMenu className={`box-shadow sticky top-0 z-50 border-slate-50 transition-[background] duration-100 dark:border-slate-800 ${scrolled ? "border-b bg-background/50 py-0 shadow-md backdrop-blur-sm" : "bg-background py-2"}`}>
        <NavigationMenuList className="flex w-screen max-w-screen justify-between px-8">
            <NavigationMenuItem>
                <NavigationMenuLink asChild className="hover:bg-transparent">
                    <Link href="/" className="flex flex-row items-center font-semibold text-xl">
                        <Image src={Logo} alt="ClassCommit" className="not-dark:invert" />
                        ClassCommit
                    </Link>
                </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className="flex flex-row items-center gap-x-2">
                <NavigationMenuLink asChild className="hidden sm:block">
                    <Link href="/classes" className="font-medium hover:cursor-pointer">
                        Classes
                    </Link>
                </NavigationMenuLink>
                {session && <UserDropdown user={session.user} />}
                {!session && <Button variant="outline" onClick={() => login()} className="hover:cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <title>GitHub</title>
                        <path
                            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                            fill="currentColor"
                        />
                    </svg>
                    Login with GitHub
                </Button>}
                <ThemeToggle />
            </NavigationMenuItem>
        </NavigationMenuList>
    </NavigationMenu>
}