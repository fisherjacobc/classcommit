import { api, HydrateClient } from "~/trpc/server";
import Editor from "../../../edit/editor";

export default async function TeacherSubmissionEdit({ params }: { params: Promise<{ classId: string; assignmentId: string; submissionId: string }> }) {
    const { classId, assignmentId, submissionId } = await params;

    const files = await api.assignments.getSubmissionFiles({ classId: Number.parseInt(classId, 10), assignmentId: Number.parseInt(assignmentId, 10), submissionId });

    return (
        <HydrateClient>
            <main className="flex">
                <Editor
                    files={files}
                    submissionId={submissionId}
                    classId={Number.parseInt(classId, 10)}
                    assignmentId={Number.parseInt(assignmentId, 10)}
                    teacherMode={true}
                />
            </main>
        </HydrateClient>
    );
}
