import Markdown from 'react-markdown'
import { api, HydrateClient } from "~/trpc/server";

export default async function AssignmentPage({ params }: { params: Promise<{ classId: string, assignmentId: string }> }) {
    const { classId, assignmentId } = await params;

    const assignmentData = await api.assignments.getAssignment({ classId: Number.parseInt(classId, 10), assignmentId: Number.parseInt(assignmentId, 10) });
    const assignmentMarkdown = await api.assignments.getReadme({ classId: Number.parseInt(classId, 10), assignmentId: Number.parseInt(assignmentId, 10) });

    return (
        <HydrateClient>
            <main className="mx-4 flex flex-col gap-y-6">
                <div className="flex flex-col border-b">
                    <span className="font-bold text-4xl">{assignmentData.name}</span>
                </div>
                <div id="markdown" className="flex flex-col gap-y-1.5">
                    <Markdown>{assignmentMarkdown}</Markdown>
                </div>
            </main>
        </HydrateClient>
    )
}