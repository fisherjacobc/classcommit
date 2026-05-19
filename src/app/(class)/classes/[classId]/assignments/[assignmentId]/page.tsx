import { CheckCircle, ExternalLinkIcon, XCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Markdown from "react-markdown";
import { Button } from "~/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { api, HydrateClient } from "~/trpc/server";
import RubricEditor from "./rubric-editor";

export default async function AssignmentPage({
    params,
}: {
    params: Promise<{ classId: string; assignmentId: string }>;
}) {
    const { classId, assignmentId } = await params;

    const membershipData = await api.classes.getMembership({
        classId: Number.parseInt(classId, 10),
    });

    const assignmentData = await api.assignments.getAssignment({
        classId: Number.parseInt(classId, 10),
        assignmentId: Number.parseInt(assignmentId, 10),
    });
    const assignmentMarkdown = await api.assignments.getReadme({
        classId: Number.parseInt(classId, 10),
        assignmentId: Number.parseInt(assignmentId, 10),
    });
    const rubricData = await api.assignments.getAssignmentRubric({
        classId: Number.parseInt(classId, 10),
        assignmentId: Number.parseInt(assignmentId, 10),
    });
    const mySubmission =
        membershipData.role === "STUDENT"
            ? await api.assignments.getMyAssignmentSubmission({
                classId: Number.parseInt(classId, 10),
                assignmentId: Number.parseInt(assignmentId, 10),
            })
            : null;

    async function publishAssignment() {
        "use server";
        await api.assignments.publishAssignment({
            classId: Number.parseInt(classId, 10),
            assignmentId: Number.parseInt(assignmentId, 10),
        });
        redirect(`/${classId}/assignments/${assignmentId}`);
    }

    return (
        <HydrateClient>
            <main className="mx-4 flex flex-col gap-y-6">
                <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b">
                    <span className="font-bold text-4xl">{assignmentData.name}</span>
                    <div className="flex items-center gap-3">
                        {membershipData && membershipData.role !== "STUDENT" ? (
                            <Link href={`/classes/${classId}/assignments/${assignmentId}/submissions`}>
                                <Button variant="outline">View submissions</Button>
                            </Link>
                        ) : null}
                        {membershipData && membershipData.role !== "STUDENT" ? (
                            assignmentData.published ? (
                                <span className="flex items-center gap-2 font-medium text-green-600">
                                    <CheckCircle className="h-5 w-5" />
                                    Published
                                </span>
                            ) : (
                                <form action={publishAssignment}>
                                    <Button type="submit">Publish</Button>
                                </form>
                            )
                        ) : assignmentData.published ? (
                            <Link href={`/classes/${classId}/assignments/${assignmentId}/edit`}>
                                <Button variant="outline">
                                    <ExternalLinkIcon />
                                    Edit
                                </Button>
                            </Link>
                        ) : (
                            <span className="flex items-center gap-2 font-medium text-red-600">
                                <XCircle className="h-5 w-5" />
                                Unpublished
                            </span>
                        )}
                    </div>
                </div>
                <div id="markdown" className="flex flex-col gap-y-1.5">
                    <Markdown>{assignmentMarkdown}</Markdown>
                </div>
                {membershipData.role === "STUDENT" ? (
                    <section className="rounded-md border p-4">
                        <h2 className="font-semibold text-2xl">Submission</h2>
                        <div className="mt-2 text-muted-foreground text-sm">
                            {mySubmission?.submission?.submittedAt ? (
                                <>
                                    Submitted on {new Date(mySubmission.submission.submittedAt).toLocaleString()}
                                    {mySubmission.submission.grade !== null ? (
                                        <span className="ml-2 font-medium text-foreground">
                                            Score: {mySubmission.submission.grade} / {mySubmission.assignment.points}
                                        </span>
                                    ) : (
                                        <span className="ml-2 font-medium text-foreground">Score pending</span>
                                    )}
                                </>
                            ) : (
                                <span>Not submitted yet.</span>
                            )}
                        </div>
                    </section>
                ) : null}
                <section className="mt-8 space-y-4 rounded-md border p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="font-semibold text-2xl">Rubric</h2>
                            {rubricData.rubric ? (
                                <p className="text-muted-foreground text-sm">
                                    Total points: {rubricData.rubric.totalPoints} / assignment
                                    points: {rubricData.rubric.assignmentPoints}
                                </p>
                            ) : (
                                <p className="text-muted-foreground text-sm">
                                    No rubric has been created yet.
                                </p>
                            )}
                        </div>
                        {rubricData.rubric && membershipData.role !== "STUDENT" ? (
                            <span className="rounded-full border px-3 py-1 font-medium text-muted-foreground text-xs">
                                Autograde{" "}
                                {rubricData.rubric.autogradeWithRubric ? "enabled" : "disabled"}
                            </span>
                        ) : null}
                    </div>

                    {rubricData.rubric ? (
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-55">Criterion</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="w-27.5">Points</TableHead>
                                        <TableHead className="w-60">Expected Output</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rubricData.rubric.criteria.map((criterion) => (
                                        <TableRow key={criterion.id}>
                                            <TableCell className="font-medium">
                                                {criterion.name}
                                            </TableCell>
                                            <TableCell>{criterion.description ?? "—"}</TableCell>
                                            <TableCell>{criterion.points}</TableCell>
                                            <TableCell>
                                                {criterion.expectedCodeOutput ?? "—"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : null}

                    {membershipData.role !== "STUDENT" ? (
                        <RubricEditor
                            classId={Number.parseInt(classId, 10)}
                            assignmentId={Number.parseInt(assignmentId, 10)}
                            assignmentPoints={assignmentData.points}
                            rubric={rubricData.rubric}
                        />
                    ) : null}
                </section>
            </main>
        </HydrateClient>
    );
}
