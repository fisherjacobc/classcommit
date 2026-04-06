import { Asterisk, ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect, unauthorized, } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "~/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Field, FieldGroup } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient, } from "~/trpc/server";
import CreationError from "./creation-error";

export const metadata: Metadata = {
    title: "Classes",
    description: "A web-based application that brings the power of GitHub into programming classrooms.",
    icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function Classes() {
    const session = await getSession();

    if (!session)
        unauthorized();

    async function createClass(formData: FormData) {
        "use server";

        const rawFormData = {
            className: formData.get('name')?.toString(),
            githubRepo: formData.get('githubRepo')?.toString(),
            term: formData.get('term')?.toString(),
        }

        if (rawFormData.className === undefined || rawFormData.className === "") {
            return redirect("/classes?creation-error=Invalid class name");
        }

        if (rawFormData.githubRepo === undefined || rawFormData.githubRepo === "") {
            return redirect("/classes?creation-error=Invalid GitHub Repository");
        }

        //@ts-expect-error Form data already validated
        const res = await api.classes.createClass({ ...rawFormData })
        redirect(`/classes/${res.id}`);
    }

    const classes = await api.classes.getClasses();
    const githubRepos = (await api.github.getRepos()).map((r) => r.full_name);

    return (
        <HydrateClient>
            <CreationError />
            <main className="mx-4 flex min-h-screen flex-col gap-y-12 pt-8 sm:mx-10 lg:mx-16">
                <section>
                    <span className="border-b pb-2 font-semibold text-4xl tracking-tight first:mt-0">Teaching</span>
                    <div className="mt-8 grid grid-cols-1 gap-4 rounded-md border p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {classes.filter(c => c.role !== "STUDENT").map(({ class: teacherClasses }) => {
                            return <Card key={teacherClasses.id} className="mx-auto aspect-video w-full max-w-sm justify-center">
                                <CardHeader>
                                    <CardTitle>{teacherClasses.name}</CardTitle>
                                    <CardDescription>
                                        {teacherClasses.term}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="mx-auto">
                                    {teacherClasses.githubRepo ? <Link href={`https://github.com/${teacherClasses.githubRepo}`} className="flex gap-x-0.5 hover:underline">{teacherClasses.githubRepo} <ExternalLink className="size-4" /></Link> : "No Repository"}
                                </CardContent>
                                <CardFooter>
                                    <Button variant="link" className="w-full hover:cursor-pointer">
                                        <Link href={`/classes/${teacherClasses.id}`}>Open</Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        })}
                        <Card className="mx-auto aspect-video w-full max-w-sm justify-center border-2 border-dashed ring-0">
                            <CardContent className="mx-auto">
                                <Plus className="size-12" />
                            </CardContent>
                            <CardFooter>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="w-full">
                                            Create a Class
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-sm">
                                        <form action={createClass} className="gap-6">
                                            <DialogHeader>
                                                <DialogTitle>Create a Class</DialogTitle>
                                            </DialogHeader>
                                            <FieldGroup className="my-4">
                                                <Field>
                                                    <Label htmlFor="name-1" className="gap-x-0">Class Name<Asterisk className="-mt-2 size-3.5 pl-0 text-red-500" /></Label>
                                                    <Input id="name-1" name="name" placeholder="My Class" />
                                                </Field>
                                                <Field>
                                                    <Label htmlFor="githubRepo-1">GitHub Repo</Label>
                                                    <Select name="githubRepo">
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a GitHub Repo" id="githubRepo-1" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectGroup>
                                                                {githubRepos.map((r) =>
                                                                    <SelectItem key={r} value={r}>{r}</SelectItem>
                                                                )}
                                                            </SelectGroup>
                                                        </SelectContent>
                                                    </Select>
                                                </Field>
                                                <Field>
                                                    <Label htmlFor="term-1">Class Term</Label>
                                                    <Input id="term-1" name="term" placeholder="Spring 2026" />
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
                            </CardFooter>
                        </Card>
                    </div>
                </section>
                <section>
                    <span className="border-b pb-2 font-semibold text-4xl tracking-tight first:mt-0">Enrolled</span>
                    <div className="mt-8 grid grid-cols-1 gap-4 rounded-md border p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        <Card className="mx-auto aspect-video w-full max-w-sm justify-center border-2 border-dashed ring-0">
                            <CardContent className="mx-auto">
                                <Plus className="size-12" />
                            </CardContent>
                            <CardFooter>
                                <Dialog>
                                    <form className="w-full">
                                        <DialogTrigger asChild>
                                            <Button variant="outline" className="w-full">
                                                Join a Class
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-sm">
                                            <DialogHeader>
                                                <DialogTitle>Join a Class</DialogTitle>
                                            </DialogHeader>
                                            <FieldGroup>
                                                <Field>
                                                    <Label htmlFor="code-1" className="gap-x-0">Class Code<Asterisk className="-mt-2 size-3.5 pl-0 text-red-500" /></Label>
                                                    <Input id="code-1" name="code" placeholder="XXXXXX" required />
                                                </Field>
                                            </FieldGroup>
                                            <DialogFooter>
                                                <DialogClose asChild>
                                                    <Button variant="outline">Cancel</Button>
                                                </DialogClose>
                                                <Button type="submit">Join</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </form>
                                </Dialog>
                            </CardFooter>
                        </Card>
                    </div>
                </section>
            </main>
        </HydrateClient>
    )
}