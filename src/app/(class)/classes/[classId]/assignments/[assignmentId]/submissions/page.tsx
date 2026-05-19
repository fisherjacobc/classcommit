import Link from "next/link";
import { redirect } from "next/navigation";
import { api, HydrateClient } from "~/trpc/server";

type SubmissionRow = Awaited<ReturnType<typeof api.assignments.getSubmissionsForAssignment>>[number];

export default async function SubmissionsPage({ params }: { params: Promise<{ classId: string; assignmentId: string }> }) {
    const { classId, assignmentId } = await params;

    const membership = await api.classes.getMembership({ classId: Number.parseInt(classId, 10) });
    if (membership.role === "STUDENT") {
        // Not authorized for students
        return redirect(`/classes/${classId}`);
    }

    const submissions = await api.assignments.getSubmissionsForAssignment({ classId: Number.parseInt(classId, 10), assignmentId: Number.parseInt(assignmentId, 10) });

    return (
        <HydrateClient>
            <main className="mx-4">
                <div className="flex w-full justify-between">
                    <span className="font-bold text-4xl">Submissions</span>
                </div>
                <div className="mt-4 space-y-3">
                    {submissions.length === 0 ? (
                        <p>No submissions yet.</p>
                    ) : (
                        submissions.map((s: SubmissionRow) => (
                            <div key={s.id} className="flex items-center justify-between rounded-md border p-3">
                                <div>
                                    <div className="font-medium">{s.student?.name ?? s.studentId}</div>
                                    <div className="text-muted-foreground text-sm">{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "Not submitted"}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="text-sm">Grade: {s.grade ?? "-"}</div>
                                    <Link href={`/classes/${classId}/assignments/${assignmentId}/submissions/${s.id}/edit`} className="rounded bg-white/10 px-3 py-1">Open</Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </HydrateClient>
    );
}
