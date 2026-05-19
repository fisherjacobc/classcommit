import { env } from "~/env";

export type LtiLaunchKind = "class" | "assignment";

export type LtiDeepLinkResource = {
	type: "ltiResourceLink";
	url: string;
	title: string;
	text?: string;
	custom?: Record<string, string>;
	icon?: {
		url: string;
	};
};

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getAppBaseUrl = () => {
	const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? env.BETTER_AUTH_URL;
	return stripTrailingSlash(rawBaseUrl);
};

export const getClassLaunchUrl = (classId: number) =>
	`${getAppBaseUrl()}/classes/${classId}`;

export const getAssignmentLaunchUrl = (classId: number, assignmentId: number) =>
	`${getAppBaseUrl()}/classes/${classId}/assignments/${assignmentId}`;

export const getLaunchUrl = (params: {
	kind: LtiLaunchKind;
	classId: number;
	assignmentId?: number;
}) =>
	params.kind === "class"
		? getClassLaunchUrl(params.classId)
		: (() => {
				if (params.assignmentId === undefined) {
					throw new Error("assignmentId is required for assignment launches.");
				}
				return getAssignmentLaunchUrl(params.classId, params.assignmentId);
			})();

export const buildClassDeepLinkResource = (params: {
	classId: number;
	label?: string;
}) => ({
	type: "ltiResourceLink" as const,
	url: getClassLaunchUrl(params.classId),
	title: params.label ?? `Class ${params.classId}`,
	text: "Open the class-specific page in ClassCommit",
	custom: {
		classId: String(params.classId),
		launchKind: "class",
	},
});

export const buildAssignmentDeepLinkResource = (params: {
	classId: number;
	assignmentId: number;
	label?: string;
}) => ({
	type: "ltiResourceLink" as const,
	url: getAssignmentLaunchUrl(params.classId, params.assignmentId),
	title: params.label ?? `Assignment ${params.assignmentId}`,
	text: "Open the assignment workspace in ClassCommit",
	custom: {
		classId: String(params.classId),
		assignmentId: String(params.assignmentId),
		launchKind: "assignment",
	},
});

export const buildCanvasLaunchCustomParameters = (params: {
	classId: number;
	assignmentId?: number;
	launchKind: LtiLaunchKind;
}) => {
	const customParameters: Record<string, string> = {
		"canvas.classcommit.launch_kind": params.launchKind,
		"canvas.classcommit.class_id": String(params.classId),
	};

	if (params.assignmentId !== undefined) {
		customParameters["canvas.classcommit.assignment_id"] = String(
			params.assignmentId,
		);
	}

	return customParameters;
};

export const buildAssignmentLineItemLabel = (params: {
	className: string;
	assignmentName: string;
}) => `${params.className} - ${params.assignmentName}`;

export const buildLineItemUrl = (classId: number, assignmentId: number) =>
	`${getAppBaseUrl()}/api/lti/classes/${classId}/assignments/${assignmentId}/lineitem`;

export const buildGradeSyncPayload = (params: {
	userId: string;
	scoreGiven: number;
	scoreMaximum: number;
	comment?: string;
}) => ({
	userId: params.userId,
	scoreGiven: params.scoreGiven,
	scoreMaximum: params.scoreMaximum,
	comment: params.comment,
});
