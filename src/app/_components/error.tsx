"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeProvider } from "~/components/theme-provider";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { Separator } from "~/components/ui/separator";

import "~/styles/globals.css";

interface ErrorPageProps {
    title: string;
    description: string;
    Icon: ReactNode;
}

export default async function ErrorPage({ title, description, Icon }: ErrorPageProps) {
    const router = useRouter();

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
        >
            <main className="absolute top-0 left-0 flex h-screen w-screen flex-col items-center justify-center gap-y-2">
                {Icon}
                <div className="flex items-center gap-x-2">
                    <h1 className="font-bold text-4xl">{title}</h1>
                    <Separator orientation="vertical" />
                    <span>{description}</span>
                </div>
                <ButtonGroup>
                    <Button variant="secondary" className="hover:cursor-pointer" onClick={() => router.back()}><ArrowLeft /> Go Back</Button>
                    <Button variant="default" className="hover:cursor-pointer" onClick={() => router.replace("/")}>Go Home</Button>
                </ButtonGroup>
            </main>
        </ThemeProvider>
    )
}