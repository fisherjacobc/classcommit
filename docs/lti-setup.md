# LTI setup guide

This project already has the pieces needed for LTI 1.3 support, but `ltijs` is an Express-based provider, while the app itself is a Next.js app. The cleanest setup is to run a small LTI sidecar server that handles the protocol and then redirects back into ClassCommit pages.

The sidecar in this repo uses `ltijs-postgresql`, so it stores LTI protocol state in PostgreSQL instead of MongoDB.

## What the tool should expose

Use these launch targets:

- Class launch: `/classes/:classId`
- Assignment launch: `/classes/:classId/assignments/:assignmentId`

The helper functions in `src/server/lti.ts` build these URLs and deep-link content items.

## Environment variables

Add these server env vars:

- `LTI_KEY` - signing/encryption key for `ltijs`
- `NEXT_PUBLIC_APP_URL` - public base URL for the app, for example `https://classcommit.example.com`
- `LTI_PG_DATABASE` - PostgreSQL database name for the LTI provider
- `LTI_PG_USER` - PostgreSQL user for the LTI provider
- `LTI_PG_PASSWORD` - PostgreSQL password for the LTI provider
- `LTI_PG_HOST` - PostgreSQL host for the LTI provider
- `LTI_PORT` - optional port for the sidecar server, defaults to `3100`
- `LTI_GRADE_SYNC_SECRET` - optional shared secret for the grade-sync endpoint

Optional but useful:

- `NODE_ENV=production` - enables secure cookies and production launch behavior

## Recommended server shape

Run an Express sidecar or a separate Node server for LTI endpoints. The runnable script in this repo is [scripts/lti-provider.mjs](scripts/lti-provider.mjs). Example route map:

- `GET /lti/login` - OIDC login initiation
- `POST /lti/launch` - LTI launch endpoint
- `GET /lti/register` - dynamic registration endpoint
- `GET /lti/keys` - public JWK set
- `POST /lti/deeplink` - deep linking return handler
- `POST /api/lti/classes/:classId/assignments/:assignmentId/grade-sync` - grade sync helper endpoint for your app code

`ltijs` expects Express middleware and session cookies, so this is easier to maintain than forcing it into a Next route handler.

The grade sync endpoint expects the LMS user subject (`userId` in the request body). That keeps the LMS identity separate from your app login, which is important when grading a Canvas submission later.

## Example `ltijs` provider setup

```ts
import ltijsPackage from "ltijs";
import PostgresDatabase from "ltijs-postgresql";

const lti = ltijsPackage.Provider;
const postgresPlugin = new PostgresDatabase({
  database: process.env.LTI_PG_DATABASE!,
  user: process.env.LTI_PG_USER!,
  pass: process.env.LTI_PG_PASSWORD!,
  host: process.env.LTI_PG_HOST!,
});

lti.setup(process.env.LTI_KEY!, { plugin: postgresPlugin }, {
  appRoute: "/lti/launch",
  loginRoute: "/lti/login",
  keysetRoute: "/lti/keys",
  dynRegRoute: "/lti/register",
  dynReg: {
    url: process.env.NEXT_PUBLIC_APP_URL!,
    name: "ClassCommit",
    autoActivate: true,
    useDeepLinking: true,
  },
});
```

## Canvas dynamic registration

Canvas does support LTI 1.3 tool registration flows in many deployments, but availability can vary by district/tenant settings. With `ltijs`, dynamic registration is exposed at `/lti/register`.

A typical registration request looks like this:

1. Admin opens your registration URL.
2. LMS sends you `openid_configuration`.
3. `ltijs` fetches the LMS configuration and posts the tool registration.
4. The LMS returns `client_id`, and the platform is stored in the provider DB.

The first successful launch also mirrors the platform into the app database so ClassCommit can relate LTI launches to assignments and line items.

If dynamic registration is not enabled in a given Canvas instance, you can still use manual registration by copying:

- `login initiation URL` -> `/lti/login`
- `redirect URI` -> `/lti/launch`
- `JWKS URL` -> `/lti/keys`
- `target link URI` -> the class or assignment launch URL

## Grade sync flow

When an assignment is launched from Canvas with AGS enabled, the launch token usually contains the `lineitems` endpoint. Use that token to:

1. Find or create the line item for the assignment.
2. Store the resulting `lineItem.id` on the class or assignment record.
3. Send score updates to `lineItem.id/scores` whenever a submission is graded.

For ClassCommit, a good model is:

- one line item per assignment
- one score per student submission or group submission
- score maximum = assignment points

The helper in [src/server/lti.ts](src/server/lti.ts) builds a predictable lineitem URL if you want to keep your own mapping, and the sidecar stores the real Canvas line item URL after the first launch.

## Suggested database fields

Add fields like these to `Assignment`:

- `ltiResourceLinkId`
- `ltiPlatformId`

For launch context, you can also store:

- `ltiDeploymentId`
- `ltiContextId`

## How to wire it into the existing app

- Keep the LTI protocol handling in the sidecar provider.
- Redirect launches back to the Next app using the class or assignment URL.
- Use your existing grade endpoints to decide when a submission is graded.
- After grading, call the AGS score endpoint with the stored line item id.

To start the sidecar locally, run:

```bash
pnpm lti:dev
```

## Practical implementation order

1. Add the LTI provider sidecar.
2. Register a Canvas developer key or dynamic registration URL.
3. Store launch metadata on class/assignment records.
4. Add the deep-link menu action in the teacher UI.
5. Add score sync after grade creation/update.
