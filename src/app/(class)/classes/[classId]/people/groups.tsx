"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { api as trpc } from "~/trpc/react";

type StudentItem = { userId: string; name?: string | null; handle?: string | null };

export default function GroupsClient({ classId, students }: { classId: number; students: StudentItem[] }) {
    const utils = trpc.useContext();

    const { data: groups } = trpc.groups.getGroups.useQuery({ classId }, { enabled: true });

    const createGroup = trpc.groups.createGroup.useMutation({
        onSuccess: () => utils.groups.getGroups.invalidate(),
    });

    const assignMutation = trpc.groups.assignStudentsToGroup.useMutation({
        onSuccess: () => utils.groups.getGroups.invalidate(),
    });

    const autoCreate = trpc.groups.autoCreateAndAssignGroups.useMutation({
        onSuccess: () => utils.groups.getGroups.invalidate(),
    });

    const [newGroupName, setNewGroupName] = useState("");
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>("");
    const [groupSize, setGroupSize] = useState<number>(2);
    const [groupPrefix, setGroupPrefix] = useState<string>("Group");
    const [replaceExisting, setReplaceExisting] = useState<boolean>(true);

    const toggleStudent = (id: string) => {
        setSelectedStudentIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-semibold text-lg">Groups</h3>
                <div className="mt-2 space-y-2">
                    {(groups ?? []).map((g: any) => (
                        <div key={g.id} className="rounded-md border p-3">
                            <div className="flex items-center justify-between">
                                <div className="font-medium">{g.name}</div>
                                <div className="text-neutral-500 text-sm">{g.members.length} members</div>
                            </div>
                            <div className="mt-2 text-neutral-700 text-sm">{g.members.map((m: any) => m.student.name).join(", ")}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-md border p-3">
                <h4 className="font-medium">Create group</h4>
                <div className="mt-2 flex gap-2">
                    <input className="flex-1 rounded border px-2 py-1" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Group name" />
                    <Button
                        className="rounded bg-blue-600 px-3 py-1 text-white"
                        onClick={() => {
                            if (!newGroupName.trim()) return;
                            createGroup.mutate({ classId, name: newGroupName.trim() });
                            setNewGroupName("");
                        }}
                    >
                        Create
                    </Button>
                </div>
            </div>

            <div className="rounded-md border p-3">
                <h4 className="font-medium">Assign students to group</h4>
                <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                        <div className="font-medium text-sm">Students</div>
                        <div className="mt-2 max-h-48 overflow-auto rounded border p-2">
                            {students.map((s) => (
                                <label key={s.userId} className="flex items-center gap-2 py-1">
                                    <input type="checkbox" checked={selectedStudentIds.includes(s.userId)} onChange={() => toggleStudent(s.userId)} />
                                    <span className="text-sm">{s.name ?? s.handle ?? s.userId}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="font-medium text-sm">Target group</div>
                        <select className="mt-2 w-full rounded border px-2 py-1" value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
                            <option value="">Select group</option>
                            {(groups ?? []).map((g: any) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>

                        <div className="mt-4 flex items-center gap-2">
                            <label className="text-sm">
                                <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} /> Replace existing
                            </label>
                        </div>

                        <div className="mt-4">
                            <Button
                                className="rounded bg-green-600 px-3 py-1 text-white"
                                onClick={() => {
                                    if (!selectedGroupId || selectedStudentIds.length === 0) return;
                                    assignMutation.mutate({ classId, groupId: selectedGroupId, studentIds: selectedStudentIds, replaceExisting });
                                    setSelectedStudentIds([]);
                                }}
                            >
                                Assign selected
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-md border p-3">
                <h4 className="font-medium">Auto-create groups</h4>
                <div className="mt-2 grid grid-cols-3 items-end gap-2">
                    <div>
                        <label className="text-sm">Group size</label>
                        <input type="number" min={2} value={groupSize} onChange={(e) => setGroupSize(Number(e.target.value))} className="mt-1 w-full rounded border px-2 py-1" />
                    </div>
                    <div>
                        <label className="text-sm">Name prefix</label>
                        <input value={groupPrefix} onChange={(e) => setGroupPrefix(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
                    </div>
                    <div>
                        <Button
                            className="w-full rounded bg-orange-600 px-3 py-1 text-white"
                            onClick={() => {
                                autoCreate.mutate({ classId, groupSize, groupNamePrefix: groupPrefix, replaceExisting });
                            }}
                        >
                            Auto-create
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
