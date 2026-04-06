import { HydrateClient } from "~/trpc/server";
import Editor from "./editor";

export default async function EditAssignment({ params }: { params: Promise<{ classId: string; assignmentId: string; }> }) {
    const { classId, assignmentId } = await params;

    return (
        <HydrateClient>
            <main className="flex flex-col gap-y-12">
                <Editor />
            </main>
        </HydrateClient>
    )
}