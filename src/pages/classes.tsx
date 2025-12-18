import { Button, Modal, TextInput } from "@instructure/ui";
import { IconPlusSolid } from "@instructure/ui-icons";
import type { Class } from "@prisma/client";
import type {
	GetServerSidePropsContext,
	InferGetServerSidePropsType,
} from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { requireAuth } from "~/hooks";
import { serverSideApi } from "~/server/api/root";
import { getServerSessionProps } from "~/server/auth";
import { api } from "~/utils/api";

type ClassesProps = InferGetServerSidePropsType<typeof getServerSideProps>;

export default function Classes({ session, classes }: ClassesProps) {
	requireAuth(session);
	const [createFormData, setCreateFormData] = useState({
		className: "",
		term: ""
	})
	const [openCreateModal, setOpenCreateModal] = useState(false);

	const handleButtonClick = () => {
		setOpenCreateModal((s) => !s);
	};

	const createClassMutation = api.classes.createClass.useMutation();

	const router = useRouter();

	const handleCreateSubmit = (e: { preventDefault: () => void; }) => {
		e.preventDefault();

		createClassMutation.mutateAsync(createFormData).then((res) => {
			router.push(`/classes/${res.id}`);
		});

		setOpenCreateModal(false);
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
				label="Create Class"
				shouldCloseOnDocumentClick
			>
				<Modal.Header>
					<span className="text-2xl">Create Class</span>
				</Modal.Header>
				<Modal.Body>
					<TextInput renderLabel="Class Name" isRequired={true} value={createFormData.className} onChange={(e) => setCreateFormData({ className: e.target.value, term: createFormData.term })} />
					<TextInput renderLabel="Term" placeholder="Fall 2025" value={createFormData.term} onChange={(e) => setCreateFormData({ className: createFormData.className, term: e.target.value })} />
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
			<span className="mx-4 text-4xl sm:mx-8 md:mx-16 lg:mx-24 xl:mx-32">
				Classes
			</span>
			<div className="mx-4 grid gap-4 rounded-md border-2 border-slate-500 p-4 sm:mx-8 sm:grid-cols-2 md:mx-16 md:grid-cols-3 lg:mx-24 xl:mx-32 xl:grid-cols-4">
				{(JSON.parse(classes) as (Class & { createdBy: { id: string; name: string; } })[]).map((classData) =>
					<Link key={classData.id} href={`/classes/${classData.id}`}>
						<Card className="aspect-video border-4 hover:cursor-pointer hover:border-indigo-400">
							<CardHeader>
								<CardTitle className="text-center text-2xl">{classData.name}</CardTitle>
								<hr />
								<CardDescription className="text-center font-slate-500">{classData.term} &bull; Instructor: {classData.createdBy.name}</CardDescription>
							</CardHeader>
							<CardContent className="flex justify-center">
								{/* <IconPlusSolid color="secondary" size="medium" /> */}
							</CardContent>
						</Card>
					</Link>
				)}
				<button type="button" onClick={handleButtonClick}>
					<Card className="aspect-video border-4 border-dashed hover:cursor-pointer hover:border-indigo-400">
						<CardHeader>
							<CardTitle className="text-center">Create new class</CardTitle>
						</CardHeader>
						<CardContent className="flex justify-center">
							<IconPlusSolid color="secondary" size="medium" />
						</CardContent>
					</Card>
				</button>
			</div>
		</div>
	);
}

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
	const {
		props: { session },
	} = await getServerSessionProps(ctx);

	const helper = await serverSideApi(ctx);

	const classes = await helper.classes.getClasses.fetch();

	return {
		props: {
			session,
			classes: JSON.stringify(classes),
			trpcState: helper.dehydrate(),
		},
	};
};
