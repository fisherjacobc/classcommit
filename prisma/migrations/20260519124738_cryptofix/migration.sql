-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "LtiPlatform" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authLoginUrl" TEXT NOT NULL,
    "authTokenUrl" TEXT NOT NULL,
    "keySetUrl" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LtiPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LtiIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LtiIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LtiResourceLink" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "resourceLinkId" TEXT NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "lineitemUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LtiResourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LtiPlatform_issuer_key" ON "LtiPlatform"("issuer");

-- CreateIndex
CREATE UNIQUE INDEX "LtiIdentity_issuer_subject_key" ON "LtiIdentity"("issuer", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "LtiResourceLink_platformId_deploymentId_resourceLinkId_key" ON "LtiResourceLink"("platformId", "deploymentId", "resourceLinkId");

-- AddForeignKey
ALTER TABLE "LtiIdentity" ADD CONSTRAINT "LtiIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LtiResourceLink" ADD CONSTRAINT "LtiResourceLink_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "LtiPlatform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LtiResourceLink" ADD CONSTRAINT "LtiResourceLink_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
