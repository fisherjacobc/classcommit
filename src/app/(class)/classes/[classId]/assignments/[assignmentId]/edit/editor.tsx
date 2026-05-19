"use client";
import MonacoEditor, { useMonaco } from '@monaco-editor/react';
import { ChevronRight, File } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Sidebar, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "~/components/ui/sidebar";
import { api as trpc } from "~/trpc/react";
import type { api } from "~/trpc/server";
import darkTheme from './darkTheme';

type FeedbackItem = {
    id: string;
    filePath: string;
    startLine: number;
    endLine: number;
    comment: string;
};

type FileItemType = Awaited<ReturnType<typeof api.assignments.getMyAssignmentFiles>>["files"][number];

type SubmissionFilesEditor = {
    files: FileItemType[];
    submission?: {
        id: string;
        ref?: string;
        submittedAt?: Date | null;
        grade?: number | null;
    };
};

type MonacoEditorInstance = Parameters<NonNullable<React.ComponentProps<typeof MonacoEditor>["onMount"]>>[0];
type MonacoModule = Parameters<NonNullable<React.ComponentProps<typeof MonacoEditor>["onMount"]>>[1];

export function InnerEditor({ file, onMount, readOnly }: { file: { path: string; content: string; }, onMount?: (editor: MonacoEditorInstance, monaco: MonacoModule) => void, readOnly?: boolean }) {
    useMonaco()?.editor.defineTheme("dark", darkTheme);

    return <MonacoEditor height="90vh" width="60vw" path={file.path.split('/').at(-1)} defaultLanguage="java" defaultValue={file.content} theme="dark" options={{ readOnly: !!readOnly }} onMount={onMount} onChange={(val) => {
        if (!readOnly) {
            file.content = val ?? "";
        }
    }} />;
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

function EditorProvider({ children, initialActiveFile }: { children: React.ReactNode, initialActiveFile: EditorContext["activeFile"] }) {
    const [activeFile, setActiveFile] = useState<EditorContext["activeFile"]>(initialActiveFile);

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

export function Editor({ files, submissionId, classId, assignmentId, teacherMode }: { files: Awaited<ReturnType<typeof api.assignments.getMyAssignmentFiles>>, submissionId?: string, classId?: number, assignmentId?: number, teacherMode?: boolean }) {
    const { activeFile } = useEditorContext();
    const monaco = useMonaco();
    const router = useRouter();
    const [editorInstance, setEditorInstance] = useState<MonacoEditorInstance | null>(null);

    const feedbackQuery = trpc.assignments.feedback.getFeedbackForSubmission.useQuery(
        { classId: classId ?? 0, submissionId: submissionId ?? "" },
        { enabled: !!teacherMode && !!submissionId && !!classId },
    );
    const submissionQuery = trpc.assignments.getAssignmentSubmission.useQuery(
        {
            classId: classId ?? 0,
            assignmentId: assignmentId ?? 0,
            submissionId: submissionId ?? "",
        },
        { enabled: !!teacherMode && !!submissionId && !!classId && !!assignmentId },
    );

    const runCode = trpc.compiler.runCode.useMutation();
    const updateMyAssignmentFiles = trpc.assignments.updateMyAssignmentFiles.useMutation();
    const submitMyAssignment = trpc.assignments.submitMyAssignment.useMutation();
    const gradeAssignmentSubmission = trpc.assignments.gradeAssignmentSubmission.useMutation();

    const createFeedback = trpc.assignments.feedback.createFeedback.useMutation();
    const deleteFeedback = trpc.assignments.feedback.deleteFeedback.useMutation();
    const [manualGrade, setManualGrade] = useState("");

    React.useEffect(() => {
        if (submissionQuery.data?.grade !== undefined && submissionQuery.data?.grade !== null) {
            setManualGrade(String(submissionQuery.data.grade));
        }
    }, [submissionQuery.data?.grade]);

    async function compileAndRun() {
        try {
            const result = await runCode.mutateAsync({
                files: files.files.map((file) => ({
                    name: file.path.split("/").at(-1) ?? "Main.java",
                    content: file.content,
                })),
            });

            toast(result.output);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to run code.");
        }
    }

    async function submitAssignment() {
        if (!classId || !assignmentId) {
            toast.error("Missing assignment context.");
            return;
        }

        try {
            const payloadFiles = files.files.map((file) => ({
                path: file.path,
                content: file.content,
            }));

            await updateMyAssignmentFiles.mutateAsync({
                classId,
                assignmentId,
                message: "Submit assignment",
                files: payloadFiles,
            });

            await submitMyAssignment.mutateAsync({
                classId,
                assignmentId,
            });

            router.push(`/classes/${classId}/assignments/${assignmentId}`);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to submit assignment.");
        }
    }

    React.useEffect(() => {
        if (!editorInstance || !monaco || !activeFile) return;

        const feedbacks = (feedbackQuery.data ?? []) as FeedbackItem[];
        const decorations = feedbacks
            .filter((f) => f.filePath === activeFile)
            .map((f) => ({
                range: new monaco.Range(f.startLine, 1, f.endLine, 1),
                options: {
                    isWholeLine: true,
                    className: 'myFeedbackHighlight',
                    glyphMarginClassName: 'myFeedbackGutter',
                    hoverMessage: { value: f.comment },
                },
            }));

        try {
            editorInstance.deltaDecorations([], decorations.map((d) => ({ range: d.range, options: d.options })));
        } catch (_e) {
            // ignore
        }
    }, [editorInstance, monaco, activeFile, feedbackQuery.data]);

    return (
        <div className="flex flex-col">
            <div className="m-2 mt-0 flex items-center gap-2">
                <Button variant="outline" className="w-32" onClick={compileAndRun} disabled={runCode.isPending}>
                    Compile & Run
                </Button>
                {!teacherMode ? (
                    <Button onClick={submitAssignment} disabled={updateMyAssignmentFiles.isPending || submitMyAssignment.isPending}>
                        {submitMyAssignment.isPending || updateMyAssignmentFiles.isPending
                            ? "Submitting..."
                            : "Submit Assignment"}
                    </Button>
                ) : null}
                {teacherMode && <div className="text-muted-foreground text-sm">Teacher mode: editing submission {submissionId}</div>}
            </div>
            <div className="flex">
                <SidebarProvider className="flex w-72 flex-col border-r">
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
                <div className="flex flex-1">
                    <div className="flex-1">
                        <InnerEditor file={files.files.find((file) => file.path === activeFile) ?? { path: "", content: "" }} onMount={(editor) => setEditorInstance(editor)} readOnly={!!teacherMode} />
                    </div>
                    {teacherMode && (
                        <aside className="w-96 border-l p-3">
                            <div className="space-y-4">
                                <div className="space-y-2 rounded-md border p-3">
                                    <h3 className="font-medium">Grade</h3>
                                    <div className="text-muted-foreground text-sm">
                                        Current grade: {submissionQuery.data?.grade ?? "-"}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="manual-grade" className="text-sm">
                                            Override grade
                                        </Label>
                                        <Input
                                            id="manual-grade"
                                            type="number"
                                            min={0}
                                            value={manualGrade}
                                            onChange={(event) => setManualGrade(event.target.value)}
                                            placeholder="Enter grade"
                                        />
                                        <Button
                                            type="button"
                                            onClick={async () => {
                                                if (!classId || !assignmentId || !submissionId) {
                                                    toast.error("Missing submission context.");
                                                    return;
                                                }

                                                const parsedGrade = Number(manualGrade);

                                                if (Number.isNaN(parsedGrade)) {
                                                    toast.error("Enter a valid grade.");
                                                    return;
                                                }

                                                try {
                                                    await gradeAssignmentSubmission.mutateAsync({
                                                        classId,
                                                        assignmentId,
                                                        submissionId,
                                                        grade: parsedGrade,
                                                    });
                                                    submissionQuery.refetch();
                                                    toast.success("Grade saved.");
                                                } catch (error) {
                                                    toast.error(
                                                        error instanceof Error
                                                            ? error.message
                                                            : "Unable to save grade.",
                                                    );
                                                }
                                            }}
                                            disabled={gradeAssignmentSubmission.isPending}
                                        >
                                            {gradeAssignmentSubmission.isPending ? "Saving..." : "Save grade"}
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-medium">Feedback</h3>
                                    <FeedbackPanel
                                        files={files.files}
                                        submissionId={submissionId ?? ""}
                                        feedbacks={(feedbackQuery.data ?? []) as FeedbackItem[]}
                                        onCreate={async (payload: { submissionId: string; filePath: string; startLine: number; endLine: number; comment: string }) => {
                                            await createFeedback.mutateAsync({ classId: classId ?? 0, ...payload });
                                            feedbackQuery.refetch();
                                        }}
                                        onDelete={async (id: string) => {
                                            await deleteFeedback.mutateAsync({ classId: classId ?? 0, id });
                                            feedbackQuery.refetch();
                                        }}
                                    />
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </div>
        </div>
    )
}

function FeedbackPanel({ files, submissionId, feedbacks, onCreate, onDelete }: { files: SubmissionFilesEditor["files"], submissionId: string, feedbacks: FeedbackItem[], onCreate: (p: { submissionId: string; filePath: string; startLine: number; endLine: number; comment: string }) => Promise<void>, onDelete: (id: string) => Promise<void> }) {
    const [filePath, setFilePath] = useState(files[0]?.path ?? "");
    const [startLine, setStartLine] = useState(1);
    const [endLine, setEndLine] = useState(1);
    const [comment, setComment] = useState("");

    return (
        <div className="space-y-3">
            <div>
                <Label htmlFor="feedback-file" className="text-sm">File</Label>
                <select id="feedback-file" className="w-full" value={filePath} onChange={(e) => setFilePath(e.target.value)}>
                    {files.map((f) => <option key={f.path} value={f.path}>{f.path.split('/').at(-1)}</option>)}
                </select>
            </div>
            <div className="flex gap-2">
                <div className="flex-1">
                    <Label htmlFor="feedback-start" className="text-sm">Start Line</Label>
                    <input id="feedback-start" className="w-full" type="number" min={1} value={startLine} onChange={(e) => setStartLine(Number(e.target.value))} />
                </div>
                <div className="flex-1">
                    <Label htmlFor="feedback-end" className="text-sm">End Line</Label>
                    <input id="feedback-end" className="w-full" type="number" min={1} value={endLine} onChange={(e) => setEndLine(Number(e.target.value))} />
                </div>
            </div>
            <div>
                <Label htmlFor="feedback-comment" className="text-sm">Comment</Label>
                <textarea id="feedback-comment" className="w-full" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <div className="flex gap-2">
                <Button onClick={async () => {
                    if (!comment) return;
                    await onCreate({ submissionId, filePath, startLine, endLine, comment });
                    setComment("");
                }}>Add Feedback</Button>
            </div>
            <div className="mt-4">
                <h4 className="font-medium">Existing</h4>
                <div className="mt-2 space-y-2">
                    {feedbacks.map((f) => (
                        <div key={f.id} className="rounded border p-2">
                            <div className="text-muted-foreground text-sm">{f.filePath} [{f.startLine}-{f.endLine}]</div>
                            <div className="mt-1">{f.comment}</div>
                            <div className="mt-2">
                                <Button variant="outline" size="sm" onClick={() => onDelete(f.id)}>Delete</Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default function EditorWrapper({ files, submissionId, classId, assignmentId, teacherMode }: { files: Awaited<ReturnType<typeof api.assignments.getMyAssignmentFiles>>, submissionId?: string, classId?: number, assignmentId?: number, teacherMode?: boolean }) {
    return (
        <EditorProvider initialActiveFile={files.files[0]?.path ?? ""}>
            <Editor files={files} submissionId={submissionId} classId={classId} assignmentId={assignmentId} teacherMode={teacherMode} />
        </EditorProvider>
    )
}