"use client";
import MonacoEditor, { useMonaco } from '@monaco-editor/react';
import { ChevronRight, File } from "lucide-react";
import React, { useState } from "react";
import { Sidebar, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "~/components/ui/sidebar";
import type { api } from "~/trpc/server";
import darkTheme from './darkTheme';

export function InnerEditor() {
    useMonaco()?.editor.defineTheme("dark", darkTheme);

    return <MonacoEditor height="90vh" path={"Main.java"} defaultLanguage="java" defaultValue={`public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World!");
    }
}`} theme="dark" />;
}

interface EditorContext {
    activeFile: string;
    setActiveFile: (file: string) => void;
}

const EditorContext = React.createContext<EditorContext | null>(null);

function useEditorContext() {
    const context = React.useContext(EditorContext);
    if (!context) {
        throw new Error("useEditorContext must be used within an EditorProvider");
    }
    return context;
}

function EditorProvider({ children }: { children: React.ReactNode }) {
    const [activeFile, setActiveFile] = useState<EditorContext["activeFile"]>("");

    return (
        <EditorContext.Provider value={{ activeFile, setActiveFile }}>
            {children}
        </EditorContext.Provider>
    )
}

function FileItem({ index, name, path }: { index: number, name: string, path: string }) {
    const { activeFile, setActiveFile } = useEditorContext();

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                isActive={path === activeFile}
                onClick={() => path && setActiveFile(path)}
                className="whitespace-nowrap rounded-none pl-(--index) hover:bg-muted-foreground/15 focus:bg-muted-foreground/15 focus-visible:bg-muted-foreground/15 active:bg-muted-foreground/15 data-[active=true]:bg-muted-foreground/15"
                data-index={index}
                style={
                    {
                        "--index": `${index * (index === 2 ? 1.2 : 1.3)}rem`,
                    } as React.CSSProperties
                }
            >
                <ChevronRight className="invisible" />
                <File className="h-4 w-4" />
                {name}
            </SidebarMenuButton>
        </SidebarMenuItem>
    )
}

export default function Editor({ files }: { files: Awaited<ReturnType<typeof api.assignments.getMyAssignmentFiles>> }) {
    return (
        <EditorProvider>
            <SidebarProvider className="flex min-h-full! flex-col border-r">
                <Sidebar collapsible="none" className="w-full flex-1">
                    <SidebarGroupLabel className="h-12 rounded-none border-b px-4 text-sm">Files</SidebarGroupLabel>
                    <SidebarGroup className="p-0">
                        <SidebarGroupContent className="translate-x-0 gap-1.5">
                            <SidebarMenu>
                                {files.files.map((file, index) => (
                                    <FileItem key={file.path} index={index} name={file.path.split('/').at(-1) ?? "Unnamed File"} path={file.path} />
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </Sidebar>
            </SidebarProvider>
            <InnerEditor />
        </EditorProvider>
    )
}