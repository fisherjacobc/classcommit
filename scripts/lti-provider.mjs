import express from "express";
import ltijsPackage from "ltijs";
import PostgresDatabase from "ltijs-postgresql";
import { PrismaClient } from "../generated/prisma/index.js";

const lti = ltijsPackage.Provider;
const prisma = new PrismaClient();

const requiredEnv = (name) => {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
};

const stripTrailingSlash = (value) => value.replace(/\/+$/, "");

const appBaseUrl = stripTrailingSlash(
	process.env.NEXT_PUBLIC_APP_URL ?? requiredEnv("BETTER_AUTH_URL"),
);

const ltiKey = requiredEnv("LTI_KEY");
const ltiPgDatabase = requiredEnv("LTI_PG_DATABASE");
const ltiPgUser = requiredEnv("LTI_PG_USER");
const ltiPgPassword = requiredEnv("LTI_PG_PASSWORD");
const ltiPgHost = requiredEnv("LTI_PG_HOST");
const ltiPort = Number(process.env.LTI_PORT ?? 3100);
const gradeSyncSecret = process.env.LTI_GRADE_SYNC_SECRET;

const getCustomValue = (token, ...keys) => {
	const custom =
		token?.["https://purl.imsglobal.org/spec/lti/claim/custom"] ?? {};
	for (const key of keys) {
		if (typeof custom[key] === "string" && custom[key].length > 0) {
			return custom[key];
		}
	}
	return undefined;
};

const getClassLaunchUrl = (classId) => `${appBaseUrl}/classes/${classId}`;

const getAssignmentLaunchUrl = (classId, assignmentId) =>
	`${appBaseUrl}/classes/${classId}/assignments/${assignmentId}`;

const buildDeepLinkResource = ({ kind, classId, assignmentId }) =>
	kind === "assignment"
		? {
				type: "ltiResourceLink",
				url: getAssignmentLaunchUrl(classId, assignmentId),
				title: `Assignment ${assignmentId}`,
				text: "Open the assignment workspace in ClassCommit",
				custom: {
					classId: String(classId),
					assignmentId: String(assignmentId),
					launchKind: "assignment",
				},
			}
		: {
				type: "ltiResourceLink",
				url: getClassLaunchUrl(classId),
				title: `Class ${classId}`,
				text: "Open the class-specific page in ClassCommit",
				custom: {
					classId: String(classId),
					launchKind: "class",
				},
			};

const postgresPlugin = new PostgresDatabase({
	database: ltiPgDatabase,
	user: ltiPgUser,
	pass: ltiPgPassword,
	host: ltiPgHost,
});

lti.setup(
	ltiKey,
	{ plugin: postgresPlugin },
	{
		appRoute: "/lti/launch",
		loginRoute: "/lti/login",
		keysetRoute: "/lti/keys",
		dynRegRoute: "/lti/register",
		devMode: process.env.NODE_ENV !== "production",
		cookies: {
			secure: process.env.NODE_ENV === "production",
			sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
		},
		dynReg: {
			url: appBaseUrl,
			name: "ClassCommit",
			autoActivate: true,
			useDeepLinking: true,
			redirectUris: [`${appBaseUrl}/lti/launch`],
		},
	},
);

const app = lti.app;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/healthz", (_req, res) => {
	res.status(200).json({ ok: true });
});

const mirrorPlatformToPrisma = async (token) => {
	const platformList = await lti.getPlatform(token.iss, token.clientId);
	const platform = Array.isArray(platformList) ? platformList[0] : platformList;

	if (!platform) {
		throw new Error("Platform not found in LTI provider store.");
	}

	const authConfig = await platform.platformAuthConfig();

	return prisma.ltiPlatform.upsert({
		where: {
			issuer: token.iss,
		},
		create: {
			issuer: token.iss,
			clientId: await platform.platformClientId(),
			authLoginUrl: await platform.platformAuthenticationEndpoint(),
			authTokenUrl: await platform.platformAccessTokenEndpoint(),
			keySetUrl: authConfig.key,
			name: (await platform.platformName()) ?? token.iss,
		},
		update: {
			clientId: await platform.platformClientId(),
			authLoginUrl: await platform.platformAuthenticationEndpoint(),
			authTokenUrl: await platform.platformAccessTokenEndpoint(),
			keySetUrl: authConfig.key,
			name: (await platform.platformName()) ?? token.iss,
		},
	});
};

const storeLineItemForLaunch = async (token, classId, assignmentId) => {
	const assignment = await prisma.assignment.findFirst({
		where: {
			id: assignmentId,
			classId,
		},
		select: {
			id: true,
			name: true,
			points: true,
		},
	});

	if (!assignment) {
		throw new Error("Assignment not found.");
	}

	const platform = await mirrorPlatformToPrisma(token);
	const resourceLinkId =
		token?.["https://purl.imsglobal.org/spec/lti/claim/resource_link"]?.id;
	const deploymentId =
		token?.["https://purl.imsglobal.org/spec/lti/claim/deployment_id"];
	const contextId =
		token?.["https://purl.imsglobal.org/spec/lti/claim/context"]?.id ??
		token?.["https://purl.imsglobal.org/spec/lti/claim/resource_link"]?.id ??
		"unknown";

	if (!resourceLinkId || !deploymentId) {
		throw new Error("Missing LTI resource link or deployment information.");
	}

	const existing = await prisma.ltiResourceLink.findFirst({
		where: {
			platformId: platform.id,
			deploymentId,
			resourceLinkId,
		},
	});

	if (existing?.lineitemUrl) {
		return existing;
	}

	const lineItem = await lti.Grade.createLineItem(
		token,
		{
			label: assignment.name,
			scoreMaximum: assignment.points,
		},
		{ resourceLinkId: true },
	);

	return prisma.ltiResourceLink.upsert({
		where: {
			platformId_deploymentId_resourceLinkId: {
				platformId: platform.id,
				deploymentId,
				resourceLinkId,
			},
		},
		create: {
			platformId: platform.id,
			deploymentId,
			contextId,
			resourceLinkId,
			assignmentId,
			lineitemUrl: lineItem.id ?? lineItem.url ?? null,
		},
		update: {
			assignmentId,
			lineitemUrl: lineItem.id ?? lineItem.url ?? null,
		},
	});
};

lti.onConnect(async (token, _req, res) => {
	const classId = Number(
		getCustomValue(token, "canvas.classcommit.class_id", "classId"),
	);
	const assignmentIdValue = getCustomValue(
		token,
		"canvas.classcommit.assignment_id",
		"assignmentId",
	);
	const launchKind =
		getCustomValue(token, "canvas.classcommit.launch_kind", "launchKind") ??
		(assignmentIdValue ? "assignment" : "class");

	if (
		Number.isFinite(classId) &&
		assignmentIdValue &&
		launchKind === "assignment"
	) {
		const assignmentId = Number(assignmentIdValue);
		if (!Number.isFinite(assignmentId)) {
			return res
				.status(400)
				.send("Invalid assignmentId in LTI launch custom parameters.");
		}
		await storeLineItemForLaunch(token, classId, assignmentId);
		return lti.redirect(res, getAssignmentLaunchUrl(classId, assignmentId));
	}

	if (Number.isFinite(classId)) {
		return lti.redirect(res, getClassLaunchUrl(classId));
	}

	return res
		.status(400)
		.send("Missing classId in LTI launch custom parameters.");
});

lti.onDeepLinking(async (token, _req, res) => {
	const classIdValue = getCustomValue(
		token,
		"canvas.classcommit.class_id",
		"classId",
	);
	const assignmentIdValue = getCustomValue(
		token,
		"canvas.classcommit.assignment_id",
		"assignmentId",
	);
	const launchKind =
		getCustomValue(token, "canvas.classcommit.launch_kind", "launchKind") ??
		(assignmentIdValue ? "assignment" : "class");

	if (!classIdValue) {
		return res
			.status(400)
			.send("Missing classId in deep-linking custom parameters.");
	}

	const classId = Number(classIdValue);
	const assignmentId = assignmentIdValue
		? Number(assignmentIdValue)
		: undefined;
	const resource = buildDeepLinkResource({
		kind: launchKind === "assignment" ? "assignment" : "class",
		classId,
		assignmentId,
	});

	return lti.DeepLinking.createDeepLinkingForm(token, [resource]);
});

app.post(
	"/api/lti/classes/:classId/assignments/:assignmentId/grade-sync",
	async (req, res) => {
		try {
			if (
				gradeSyncSecret &&
				req.header("x-lti-grade-sync-secret") !== gradeSyncSecret
			) {
				return res.status(403).json({ error: "Invalid grade sync secret." });
			}

			const classId = Number(req.params.classId);
			const assignmentId = Number(req.params.assignmentId);
			const userId = typeof req.body.userId === "string" ? req.body.userId : "";
			const scoreGiven = Number(req.body.scoreGiven);
			const scoreMaximum =
				req.body.scoreMaximum !== undefined
					? Number(req.body.scoreMaximum)
					: undefined;
			const comment =
				typeof req.body.comment === "string" ? req.body.comment : undefined;
			const platformIssuer =
				typeof req.body.platformIssuer === "string"
					? req.body.platformIssuer
					: undefined;

			if (
				!Number.isFinite(classId) ||
				!Number.isFinite(assignmentId) ||
				!userId
			) {
				return res.status(400).json({
					error: "Missing classId, assignmentId, or userId.",
				});
			}

			const resourceLink = await prisma.ltiResourceLink.findFirst({
				where: {
					assignmentId,
					...(platformIssuer ? { platform: { issuer: platformIssuer } } : {}),
				},
				include: {
					platform: true,
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			if (!resourceLink?.lineitemUrl) {
				return res.status(409).json({
					error:
						"No stored line item URL was found for this assignment. Launch the assignment from Canvas first.",
				});
			}

			const ltiPlatform = await lti.getPlatform(
				resourceLink.platform.issuer,
				resourceLink.platform.clientId,
			);

			if (!ltiPlatform) {
				return res.status(404).json({
					error: "Registered LTI platform was not found in the provider store.",
				});
			}

			const accessToken = await ltiPlatform.platformAccessToken(
				"https://purl.imsglobal.org/spec/lti-ags/scope/score",
			);
			const assignment = await prisma.assignment.findFirst({
				where: {
					id: assignmentId,
					classId,
				},
				select: {
					points: true,
				},
			});

			const payload = {
				userId,
				scoreGiven,
				scoreMaximum: scoreMaximum ?? assignment?.points,
				comment,
				timestamp: new Date().toISOString(),
			};

			const scoreUrl = `${resourceLink.lineitemUrl.replace(/\/+$/, "")}/scores`;
			const response = await fetch(scoreUrl, {
				method: "POST",
				headers: {
					Authorization: `${accessToken.token_type} ${accessToken.access_token}`,
					"Content-Type": "application/vnd.ims.lis.v1.score+json",
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const bodyText = await response.text();
				return res.status(response.status).json({
					error: bodyText || "Canvas rejected the score payload.",
				});
			}

			return res.status(200).json({ ok: true, payload });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown grade sync error.";
			return res.status(500).json({ error: message });
		}
	},
);

const main = async () => {
	await prisma.$connect();
	await lti.deploy({ port: ltiPort });
	console.log(`LTI provider listening on port ${ltiPort}`);
};

main().catch((error) => {
	console.error("Failed to start LTI provider", error);
	process.exit(1);
});
