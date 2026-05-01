import { api, HydrateClient } from "~/trpc/server";

export default async function ClassPeoplePage({
    params,
}: { params: Promise<{ classId: string }> }) {
    const { classId } = await params;
    const data = await api.classes.getMembers({ classId: Number.parseInt(classId, 10) });
    const classData = await api.classes.getClass({ classId: Number.parseInt(classId, 10) });

    const teachers = data.filter((person) => person.role !== "STUDENT");
    const students = data.filter((person) => person.role === "STUDENT");

    return (
        <HydrateClient>
            <main className="mx-4 w-full max-w-3xl p-6">
                <span className="pb-8 font-bold text-4xl">{classData.name}</span>
                <div className="space-y-6">
                    <section>
                        <h2 className="mb-3 font-semibold text-2xl">
                            Teachers
                        </h2>
                        <ul className="space-y-3">
                            {teachers.map((person) => (
                                <li
                                    key={person.userId}
                                    className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{person.user.name}</span>
                                        <span className="text-neutral-500 text-sm">@{person.user.handle}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-3 font-semibold text-2xl">
                            Students
                        </h2>
                        <ul className="space-y-3">
                            {students.map((person) => (
                                <li
                                    key={person.userId}
                                    className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{person.user.name}</span>
                                        {person.user.handle ? (
                                            <span className="text-neutral-500 text-sm">@{person.user.handle}</span>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            </main>
        </HydrateClient>
    );
}
