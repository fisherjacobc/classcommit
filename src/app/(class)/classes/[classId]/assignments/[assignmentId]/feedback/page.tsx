import { api, HydrateClient } from "~/trpc/server";

export default async function FeedbackPage({ params }: { params: Promise<{ classId: string; assignmentId: string }> }) {
    const { classId, assignmentId } = await params;

    const feedback = await api.assignments.feedback.getFeedbackForAssignment({ classId: Number.parseInt(classId, 10), assignmentId: Number.parseInt(assignmentId, 10) });

    return (
        <HydrateClient>
            <main className="mx-4">
                <h1 className="mb-4 font-bold text-2xl">Feedback for Assignment</h1>
                {feedback.length === 0 ? (
                    <p>No feedback found for this assignment.</p>
                ) : (
                    <div className="space-y-4">
                        {feedback.map((f) => (
                            <div key={f.id} className="rounded-md border p-3">
                                <div className="text-muted-foreground text-sm">{f.submissionId ? `Submission: ${f.submissionId}` : `Group Submission: ${f.groupSubmissionId}`}</div>
                                <div className="font-medium">{f.filePath} [{f.startLine}-{f.endLine}]</div>
                                <div className="mt-2">{f.comment}</div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </HydrateClient>
    );
}
