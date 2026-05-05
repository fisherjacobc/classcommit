import { CheckCircle, ExternalLinkIcon, XCircle } from 'lucide-react';
import Link from 'next/link';
import { redirect } from "next/navigation";
import Markdown from 'react-markdown'
import { Button } from '~/components/ui/button';
import { api, HydrateClient } from "~/trpc/server";

export default async function AssignmentPage({ params }: { params: Promise<{ classId: string, assignmentId: string }> }) {
    const { classId, assignmentId } = await params;

    const membershipData = await api.classes.getMembership({ classId: Number.parseInt(classId, 10) });

    const assignmentData = await api.assignments.getAssignment({ classId: Number.parseInt(classId, 10), assignmentId: Number.parseInt(assignmentId, 10) });
    const assignmentMarkdown = await api.assignments.getReadme({ classId: Number.parseInt(classId, 10), assignmentId: Number.parseInt(assignmentId, 10) });

    async function publishAssignment() {
        "use server";
        await api.assignments.publishAssignment({ classId: Number.parseInt(classId, 10), assignmentId: Number.parseInt(assignmentId, 10) });
        redirect(`/${classId}/assignments/${assignmentId}`);
    }

    return (
        <HydrateClient>
            <main className="mx-4 flex flex-col gap-y-6">
                <div className="flex w-full justify-between border-b">
                    <span className="font-bold text-4xl">{assignmentData.name}</span>
                    {membershipData && (membershipData.role !== "STUDENT") ? (
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
                    ) : (
                        assignmentData.published ? (
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
                        )
                    )}
                </div>
                <div id="markdown" className="flex flex-col gap-y-1.5">
                    <Markdown>{assignmentMarkdown}</Markdown>
                </div>
            </main>
        </HydrateClient>
    )
}