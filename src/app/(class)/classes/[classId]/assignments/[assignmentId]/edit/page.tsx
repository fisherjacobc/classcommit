import { api, HydrateClient } from "~/trpc/server";
import Editor from "./editor";

export default async function EditAssignment({ params }: { params: Promise<{ classId: string; assignmentId: string; }> }) {
    const { classId, assignmentId } = await params;

    const files = await api.assignments.getMyAssignmentFiles({ classId: Number.parseInt(classId, 10), assignmentId: Number.parseInt(assignmentId, 10) });

    return (
        <HydrateClient>
            <main className="flex">
                <Editor files={files} />
            </main>
        </HydrateClient>
    )
}