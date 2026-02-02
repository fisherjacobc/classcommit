import { Button, DateTimeInput, IconPlusSolid, Modal, NumberInput, TextInput } from "@instructure/ui";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetStaticPropsContext, InferGetStaticPropsType } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { markdownToHtml } from "~/lib/markdown";
import { appRouter, } from "~/server/api/root";
import { api } from "~/utils/api";

// type ClassProps = InferGetStaticPropsType<typeof getStaticProps>;

export default function ClassPage(/*{ homepageMarkdown }: ClassProps*/) {
    const router = useRouter();
    const classId = Number.parseInt(router.query.classId as string);

    const { data: classData } = api.classes.getClass.useQuery({ classId });
    const { data: assignmentsData } = api.assignments.getAssignmentsForClass.useQuery({ classId });

    const [createFormData, setCreateFormData] = useState({
        name: "",
        points: 0,
        dueDate: undefined as (Date | undefined),
    })
    const [openCreateModal, setOpenCreateModal] = useState(false);

    const handleButtonClick = () => {
        setOpenCreateModal((s) => !s);
    };

    const createAssignmentMutation = api.assignments.createAssignment.useMutation();

    const handleCreateSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        createAssignmentMutation.mutateAsync({
            ...createFormData,
            classId
        }).then((res) => {
            router.push(`/classes/${classId}/assignments/${res.id}`);
        });

        setOpenCreateModal(false);
    }

    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);

    const [messages, setMessages] = useState(null)

    const handlePointsChange = (event, value) => {
        setMessages(null)
        setCreateFormData({ name: createFormData.name, dueDate: createFormData.dueDate, points: value ? Number(value) : 0 })
    }

    const handlePointsDecrement = (event) => {
        if (!Number.isNaN(createFormData.points)) {
            const newNumber =
                createFormData.points === null
                    ? 0
                    : Number.isInteger(createFormData.points)
                        ? createFormData.points - 1
                        : Math.floor(createFormData.points)
            updatePoints(newNumber)
        }
    }

    const handlePointsIncriment = (event) => {
        if (!Number.isNaN(createFormData.points)) {
            const newNumber =
                createFormData.points === null
                    ? 0 + 1
                    : Number.isInteger(createFormData.points)
                        ? createFormData.points + 1
                        : Math.ceil(createFormData.points)
            updatePoints(newNumber)
        }
    }

    const updatePoints = (n: number) => {
        const number = pointsBound(n);
        setMessages(null)

        setCreateFormData({ name: createFormData.name, dueDate: createFormData.dueDate, points: number })
    }

    const pointsBound = (n: number) => {
        if (n < 0) return 0;
        return n
    }

    const onDateChange = (e, isoDate) => {
        if (!isoDate) {
            // this happens if an invalid date is entered
            setCreateFormData({ name: createFormData.name, dueDate: undefined, points: createFormData.points })
            return
        }

        const date = new Date(isoDate)

        setCreateFormData({ name: createFormData.name, dueDate: date, points: createFormData.points })
    }

    return (
        <div className="mt-4 flex min-w-full flex-col gap-y-4">
            <Modal
                as="form"
                open={openCreateModal}
                onDismiss={() => {
                    setOpenCreateModal(false);
                }}
                onSubmit={handleCreateSubmit}
                size="auto"
                label="Create Assignment"
                shouldCloseOnDocumentClick
            >
                <Modal.Header>
                    <span className="text-2xl">Create Assignment</span>
                </Modal.Header>
                <Modal.Body>
                    <TextInput renderLabel="Assignment Name" isRequired={true} value={createFormData.name} onChange={(e) => setCreateFormData({ name: e.target.value, dueDate: createFormData.dueDate, points: createFormData.points })} />
                    <DateTimeInput
                        description="Due Date"
                        datePlaceholder="Choose a date"
                        dateRenderLabel="Date"
                        timeRenderLabel="Time"
                        invalidDateTimeMessage="Invalid date!"
                        prevMonthLabel="Previous month"
                        nextMonthLabel="Next month"
                        layout="columns"
                        isRequired={false}
                        value={createFormData.dueDate}
                        onChange={onDateChange}
                        allowNonStepInput
                    />
                    <NumberInput renderLabel="Points" isRequired={true} value={createFormData.points}
                        onChange={handlePointsChange}
                        onDecrement={handlePointsDecrement}
                        onIncrement={handlePointsIncriment}
                        messages={messages}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={handleButtonClick} margin="0 x-small 0 0">
                        Close
                    </Button>
                    <Button color="ai-primary" type="submit">
                        Create
                    </Button>
                </Modal.Footer>
            </Modal>
            <div className="mx-4 w-full justify-between text-4xl sm:mx-8 md:mx-16 lg:mx-24 xl:mx-32">
                <span>
                    {classData?.name}
                </span>
                <Button color="primary" type="submit" onClick={handleButtonClick}>
                    Create Assignment
                </Button>
            </div>
            <div className="mx-4 grid grid-cols-2 gap-4 text-4xl sm:mx-8 md:mx-16 lg:mx-24 lg:grid-cols-3 xl:mx-32 xl:grid-cols-4">
                <div className="lg:col-span-2 xl:col-span-3"/>
                <div className="flex flex-col gap-y-2">
                    {assignmentsData?.map((assignment) => 
                        <Link key={assignment.id} href={`/classes/${classId}/assignments/${assignment.id}`}>
                            <Card className="gap-2 border-4 py-4 hover:cursor-pointer hover:border-indigo-400">
                                <CardHeader>
                                    <CardTitle className="text-center text-2xl">{assignment.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex justify-center font-normal text-base text-slate-600">
                                    {assignment.points} Points{assignment.dueDate && ` | ${assignment.dueDate.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "numeric" })}`}
                                </CardContent>
                            </Card>
                        </Link>)}
                </div>
            </div>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation> */}
            {/* <div dangerouslySetInnerHTML={{ __html: homepageMarkdown.contentHtml }} /> */}
        </div>
    )
}

// export async function getStaticProps({ params }: GetStaticPropsContext<{ classId: string }>) {
//     const helpers = createServerSideHelpers({
//         router: appRouter,
//         ctx: {},
//     });
//     const classId = params?.classId as string;

//     const classData = await helpers.classes.getClass.fetch({ classId: Number.parseInt(classId) });

//     const homepageMarkdown = await markdownToHtml(classData.homepageMarkdown);

//     return {
//         props: {
//             trpcState: helpers.dehydrate(),
//             homepageMarkdown,
//         },
//         revalidate: 1,
//     };
// }