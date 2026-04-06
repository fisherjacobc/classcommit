import Markdown from 'react-markdown'
import { api, HydrateClient } from "~/trpc/server";

export default async function Classes({ params }: { params: Promise<{ classId: string }> }) {
    const { classId } = await params;

    const classData = await api.classes.getClass({ classId: Number.parseInt(classId, 10) });

    return (
        <HydrateClient>
            <main className="mx-4 flex flex-col gap-y-12">
                <span className="font-bold text-4xl">{classData.name}</span>
                <Markdown></Markdown>
            </main>
        </HydrateClient>
    )
}