import { Asterisk } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Field, FieldGroup } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { formatDate } from "~/lib/utils";
import { api, HydrateClient } from "~/trpc/server";

export default async function Classes({ params }: { params: Promise<{ classId: string }> }) {
    const classId = Number.parseInt((await params).classId, 10)

    await api.classes.getClass.prefetch({ classId });
    await api.assignments.getAssignments.prefetch({ classId });

    const _classData = await api.classes.getClass({ classId });
    const assignmentsData = await api.assignments.getAssignments({ classId })

    async function createAssignment(formData: FormData) {
        "use server";

        const rawFormData = {
            name: formData.get('assignmentName')?.toString(),
            points: Number.parseInt(formData.get('points')?.toString() ?? "0", 10),
            // biome-ignore lint/style/noNonNullAssertion: checked
            // biome-ignore lint/suspicious/noNonNullAssertedOptionalChain: checked
            dueDate: formData.get('dueDate')?.toString() ? new Date(formData.get('dueDate')?.toString()!) : undefined,
        }
        //@ts-expect-error Form data already validated
        const res = await api.assignments.createAssignment({ ...rawFormData, classId })
        redirect(`/classes/${classId}/assignments/${res.id}`);
    }

    return (
        <HydrateClient>
            <main className="mx-4 flex flex-col gap-y-4">
                <div className="flex w-full justify-between">
                    <span className="font-bold text-4xl">Assignments</span>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="">
                                Create an Assignment
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-sm">
                            <form action={createAssignment} className="gap-6">
                                <DialogHeader>
                                    <DialogTitle>Create an Assignment</DialogTitle>
                                </DialogHeader>
                                <FieldGroup className="my-4">
                                    <Field>
                                        <Label htmlFor="assignmentName-1" className="gap-x-0">Assignment Name<Asterisk className="-mt-2 size-3.5 pl-0 text-red-500" /></Label>
                                        <Input id="assignmentName-1" name="assignmentName" placeholder="My Assignment" required />
                                    </Field>
                                    <Field>
                                        <Label htmlFor="points-1" className="gap-x-0">Points<Asterisk className="-mt-2 size-3.5 pl-0 text-red-500" /></Label>
                                        <Input id="points-1" type="number" min={0} name="points" required />
                                    </Field>
                                    <Field>
                                        <Label htmlFor="dueDate-1" className="gap-x-0">Due Date</Label>
                                        <Input id="dueDate-1" type="datetime-local" name="dueDate" />
                                    </Field>
                                </FieldGroup>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit">Create</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 rounded-md border p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {assignmentsData.map((assignment) => {
                        return <Card key={assignment.id} className="mx-auto aspect-video w-full max-w-sm justify-center">
                            <CardHeader>
                                <CardTitle>{assignment.name}</CardTitle>
                                <CardDescription>
                                    {assignment.points} points {assignment.dueDate && `| ${formatDate(assignment.dueDate)}`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="mx-auto">

                            </CardContent>
                            <CardFooter>
                                <Button variant="link" className="w-full hover:cursor-pointer">
                                    <Link href={`/classes/${classId}/assignments/${assignment.id}`}>Open</Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    })}
                </div>
            </main>
        </HydrateClient>
    )
}