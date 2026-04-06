import { api, HydrateClient } from "~/trpc/server";

export default async function ClassSettings({ params }: { params: Promise<{ classId: string }> }) {
    const _data = await api.github.getRepos();

    return (
        <HydrateClient>
            <main className="mx-4 flex flex-col gap-y-12">
                {/* <span className="font-bold text-4xl">{classData.name}</span> */}

            </main>
        </HydrateClient>
    )
}