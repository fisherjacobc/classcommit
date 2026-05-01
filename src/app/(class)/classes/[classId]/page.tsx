import Markdown from 'react-markdown'
import { api, HydrateClient } from "~/trpc/server";

export default async function Classes({ params }: { params: Promise<{ classId: string }> }) {
    const { classId } = await params;

    const classData = await api.classes.getClass({ classId: Number.parseInt(classId, 10) });
    const homepageMarkdown = await api.classes.getHomepage({ classId: Number.parseInt(classId, 10) });

    return (
        <HydrateClient>
            <main className="mx-4 flex flex-col gap-y-6">
                <div className="flex flex-col border-b">
                    <span className="font-bold text-4xl">{classData.name}</span>
                    <span className="text-gray-500 text-lg">Join Code: {classData.joinCode}</span>
                </div>
                <div id="markdown" className="flex flex-col gap-y-1.5">
                    <Markdown>{homepageMarkdown}</Markdown>
                </div>
            </main>
        </HydrateClient>
    )
}