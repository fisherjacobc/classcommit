import { Button, Modal, TextInput } from "@instructure/ui";
import { IconPlusSolid } from "@instructure/ui-icons";
import type {
	GetServerSidePropsContext,
	InferGetServerSidePropsType,
} from "next";
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

type ClassesProps = InferGetServerSidePropsType<typeof getServerSideProps>;

export default function Classes({ session, classes }: ClassesProps) {
	requireAuth(session);
	const [openCreateModal, setOpenCreateModal] = useState(false);

	const handleCreateButtonClick = () => {
		setOpenCreateModal((s) => !s);
	};

	return (
		<div className="mt-4 flex min-w-full flex-col gap-y-4">
			<Modal
				as="form"
				open={openCreateModal}
				onDismiss={() => {
					setOpenCreateModal(false);
				}}
				size="auto"
				label="Create Class"
				shouldCloseOnDocumentClick
			>
				<Modal.Header>
					<span className="text-2xl">Create Class</span>
				</Modal.Header>
				<Modal.Body>
					<TextInput renderLabel="Class Name" isRequired={true} />
					<TextInput renderLabel="Term" placeholder="Fall 2025" />
				</Modal.Body>
				<Modal.Footer>
					<Button onClick={handleCreateButtonClick} margin="0 x-small 0 0">
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
			<div className="mx-4 grid gap-4 rounded-md border-2 border-gray-500 p-4 sm:mx-8 sm:grid-cols-2 md:mx-16 md:grid-cols-3 lg:mx-24 xl:mx-32 xl:grid-cols-4">
				<button type="button" onClick={handleCreateButtonClick}>
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

	let classes = null;

	try {
		// classes = await helper.classes.getUserClasses.fetch();
	} catch {}

	return {
		props: {
			session,
			classes,
			trpcState: helper.dehydrate(),
		},
	};
};
