import { Button, DateTimeInput, Modal, NumberInput, TextInput } from "@instructure/ui";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetStaticPropsContext, InferGetStaticPropsType } from "next";
import { useRouter } from "next/router";
import { useState } from "react";
import { markdownToHtml } from "~/lib/markdown";
import { appRouter, } from "~/server/api/root";
import { api } from "~/utils/api";

// type ClassProps = InferGetStaticPropsType<typeof getStaticProps>;

export default function AssignmentPage(/*{ homepageMarkdown }: ClassProps*/) {
    const router = useRouter();
    const classId = Number.parseInt(router.query.classId as string);
    const assignmentId = router.query.assignmentId as string;

    const { data: classData } = api.classes.getClass.useQuery({ classId });
    const { data: assignmentData } = api.assignments.getAssignment.useQuery({ classId, assignmentId });

    return (
        <div className="mt-4 flex min-w-full flex-col gap-y-4">
            <div className="mx-4 w-full justify-between text-4xl sm:mx-8 md:mx-16 lg:mx-24 xl:mx-32">
                <span>
                    {classData?.name} &bull; {assignmentData?.name}
                </span>
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