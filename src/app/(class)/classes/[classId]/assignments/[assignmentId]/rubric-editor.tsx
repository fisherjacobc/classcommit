"use client";

import { PlusCircle, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

type RubricCriterion = {
    id?: number;
    key: string;
    name: string;
    description: string;
    points: number;
    expectedCodeOutput: string;
};

type RubricData = {
    title: string;
    autogradeWithRubric: boolean;
    criteria: Array<{
        id: number;
        position: number;
        name: string;
        description: string | null;
        points: number;
        expectedCodeOutput: string | null;
    }>;
};

const makeCriterion = (
    criterion?: RubricData["criteria"][number],
): RubricCriterion => ({
    id: criterion?.id,
    key: globalThis.crypto.randomUUID(),
    name: criterion?.name ?? "",
    description: criterion?.description ?? "",
    points: criterion?.points ?? 0,
    expectedCodeOutput: criterion?.expectedCodeOutput ?? "",
});

export default function RubricEditor({
    classId,
    assignmentId,
    assignmentPoints,
    rubric,
}: {
    classId: number;
    assignmentId: number;
    assignmentPoints: number;
    rubric: RubricData | null;
}) {
    const mutation = api.assignments.upsertAssignmentRubric.useMutation();

    const initialCriteria = useMemo(
        () =>
            rubric?.criteria.length
                ? rubric.criteria.map((criterion) => makeCriterion(criterion))
                : [makeCriterion()],
        [rubric],
    );

    const [title, setTitle] = useState(rubric?.title ?? "");
    const [autogradeWithRubric, setAutogradeWithRubric] = useState(
        rubric?.autogradeWithRubric ?? false,
    );
    const [criteria, setCriteria] = useState<RubricCriterion[]>(initialCriteria);

    const totalPoints = criteria.reduce(
        (sum, criterion) => sum + criterion.points,
        0,
    );

    const updateCriterion = <K extends keyof RubricCriterion>(
        key: string,
        field: K,
        value: RubricCriterion[K],
    ) => {
        setCriteria((current) =>
            current.map((criterion) =>
                criterion.key === key ? { ...criterion, [field]: value } : criterion,
            ),
        );
    };

    const addCriterion = () =>
        setCriteria((current) => [...current, makeCriterion()]);

    const removeCriterion = (key: string) => {
        setCriteria((current) =>
            current.length > 1
                ? current.filter((criterion) => criterion.key !== key)
                : current,
        );
    };

    const saveRubric = async () => {
        const trimmedTitle = title.trim();

        if (!trimmedTitle) {
            toast.error("Rubric title is required.");
            return;
        }

        if (criteria.some((criterion) => !criterion.name.trim())) {
            toast.error("Every criterion needs a name.");
            return;
        }

        if (criteria.some((criterion) => criterion.points < 0)) {
            toast.error("Points must be 0 or greater.");
            return;
        }

        const payload = {
            classId,
            assignmentId,
            title: trimmedTitle,
            autogradeWithRubric,
            criteria: criteria.map((criterion) => ({
                name: criterion.name.trim(),
                description: criterion.description.trim() || undefined,
                points: criterion.points,
                expectedCodeOutput: criterion.expectedCodeOutput.trim() || undefined,
            })),
        };

        try {
            await mutation.mutateAsync(payload);
            toast.success("Rubric saved.");
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Unable to save rubric.",
            );
        }
    };

    return (
        <section className="mt-8 space-y-4 rounded-md border p-4">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="font-semibold text-2xl">Edit Rubric</h2>
                    <p className="text-muted-foreground text-sm">
                        Total rubric points: {totalPoints} / assignment points:{" "}
                        {assignmentPoints}
                    </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={autogradeWithRubric}
                        onChange={(event) => setAutogradeWithRubric(event.target.checked)}
                    />
                    Autograde with rubric
                </label>
            </div>

            <div className="space-y-2">
                <Label htmlFor="rubric-title">Rubric title</Label>
                <Input
                    id="rubric-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Participation Rubric"
                />
            </div>

            <div className="overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-55">Criterion</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-27.5">Points</TableHead>
                            <TableHead className="w-60">Expected Output</TableHead>
                            <TableHead className="w-20 text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {criteria.map((criterion) => (
                            <TableRow key={criterion.key}>
                                <TableCell>
                                    <Input
                                        value={criterion.name}
                                        onChange={(event) =>
                                            updateCriterion(criterion.key, "name", event.target.value)
                                        }
                                        placeholder="Criterion name"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Textarea
                                        value={criterion.description}
                                        onChange={(event) =>
                                            updateCriterion(
                                                criterion.key,
                                                "description",
                                                event.target.value,
                                            )
                                        }
                                        placeholder="What does this criterion measure?"
                                        rows={2}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={criterion.points}
                                        onChange={(event) =>
                                            updateCriterion(
                                                criterion.key,
                                                "points",
                                                Number(event.target.value),
                                            )
                                        }
                                    />
                                </TableCell>
                                <TableCell>
                                    <Textarea
                                        value={criterion.expectedCodeOutput}
                                        onChange={(event) =>
                                            updateCriterion(
                                                criterion.key,
                                                "expectedCodeOutput",
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Optional expected output for autograding"
                                        rows={2}
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeCriterion(criterion.key)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={addCriterion}>
                    <PlusCircle className="mr-2 size-4" />
                    Add criterion
                </Button>
                <Button
                    type="button"
                    onClick={saveRubric}
                    disabled={mutation.isPending}
                >
                    {mutation.isPending ? "Saving..." : "Save rubric"}
                </Button>
            </div>
        </section>
    );
}
