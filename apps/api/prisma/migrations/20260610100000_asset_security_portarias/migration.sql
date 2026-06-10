-- Seguranca Patrimonial e Portarias - fundacao corporativa.
-- Migration aditiva: cria enums/tabelas/indices/FKs sem alterar tabelas existentes.

CREATE TYPE "SecurityPackageStatus" AS ENUM ('ENABLED', 'DISABLED', 'TRIAL', 'READ_ONLY', 'BLOCKED', 'EXPIRED');
CREATE TYPE "SecurityRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED');
CREATE TYPE "SecurityPersonType" AS ENUM ('VISITOR', 'CONTRACTOR', 'DRIVER', 'PASSENGER', 'EMPLOYEE', 'THIRD_PARTY', 'SUPPLIER', 'REPRESENTATIVE', 'AUTHORITY', 'GUEST', 'BLOCKED');
CREATE TYPE "SecurityDocumentStatus" AS ENUM ('VALID', 'EXPIRING', 'EXPIRED', 'MISSING', 'IN_REVIEW', 'REJECTED', 'BLOCKED', 'NOT_REQUIRED');
CREATE TYPE "SecurityAuthorizationStatus" AS ENUM ('DRAFT', 'REQUESTED', 'WAITING_DOCUMENTS', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'USED', 'PARTIALLY_USED');
CREATE TYPE "SecurityMovementType" AS ENUM ('PERSON_ENTRY', 'PERSON_EXIT', 'VEHICLE_ENTRY', 'VEHICLE_EXIT', 'MATERIAL_ENTRY', 'MATERIAL_EXIT', 'EQUIPMENT_ENTRY', 'EQUIPMENT_EXIT', 'CARGO', 'UNLOADING', 'CORRESPONDENCE', 'KEY_LOAN', 'KEY_RETURN', 'BADGE_DELIVERY', 'BADGE_RETURN');
CREATE TYPE "SecurityMovementStatus" AS ENUM ('OPEN', 'CLOSED', 'PENDING', 'BLOCKED', 'CANCELLED', 'OVERDUE');
CREATE TYPE "SecurityIncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY');
CREATE TYPE "SecurityIncidentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ACTION', 'CLOSED', 'CANCELLED');
CREATE TYPE "SecurityRoundStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE', 'LATE', 'MISSED', 'CANCELLED');
CREATE TYPE "SecurityShiftHandoverStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING_REVIEW', 'WAITING_ACCEPTANCE', 'COMPLETED', 'COMPLETED_WITH_PENDING');
CREATE TYPE "SecurityCustodyItemType" AS ENUM ('KEY', 'BADGE');
CREATE TYPE "SecurityCustodyStatus" AS ENUM ('AVAILABLE', 'LOANED', 'OVERDUE', 'LOST', 'BLOCKED', 'MAINTENANCE', 'INACTIVE');
CREATE TYPE "SecurityQrStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'USED', 'BLOCKED');
CREATE TYPE "SecurityOfflineSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR');
CREATE TYPE "SecurityRecordOrigin" AS ENUM ('WEB', 'MOBILE', 'PORTAL', 'API', 'IMPORT', 'OFFLINE');

CREATE TABLE "SecurityPackageActivation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "unitId" TEXT,
  "code" TEXT NOT NULL DEFAULT 'asset-security',
  "status" "SecurityPackageStatus" NOT NULL DEFAULT 'TRIAL',
  "enabledFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "limits" JSONB,
  "settings" JSONB,
  "trialStartedAt" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "blockedAt" TIMESTAMP(3),
  "blockReason" TEXT,
  "commercialPlanCode" TEXT,
  "configuredById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityPackageActivation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityGate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "unitId" TEXT,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "location" TEXT,
  "type" TEXT NOT NULL,
  "workingHours" JSONB,
  "shifts" JSONB,
  "responsibleUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "supervisorUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowedAccessTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "flowCapabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "authorizedAreaIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "rules" JSONB,
  "requiredDocumentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "checklistTemplateIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "contacts" JSONB,
  "notes" TEXT,
  "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "activatedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityGate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityPost" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "unitId" TEXT,
  "gateId" TEXT,
  "routeId" TEXT,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "type" TEXT,
  "schedule" TEXT,
  "criticality" TEXT NOT NULL DEFAULT 'MEDIUM',
  "responsibleUserId" TEXT,
  "equipmentRequired" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "radio" TEXT,
  "phone" TEXT,
  "qrCodeToken" TEXT,
  "checklistTemplateId" TEXT,
  "instructions" TEXT,
  "emergencyContacts" JSONB,
  "currentResponsibleId" TEXT,
  "currentShiftStartedAt" TIMESTAMP(3),
  "currentShiftEndsAt" TIMESTAMP(3),
  "lastOpenedAt" TIMESTAMP(3),
  "lastClosedAt" TIMESTAMP(3),
  "pendingCount" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityPerson" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "type" "SecurityPersonType" NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "socialName" TEXT,
  "documentType" TEXT,
  "documentNumber" TEXT,
  "documentMasked" TEXT,
  "birthDate" TIMESTAMP(3),
  "contractorCompanyId" TEXT,
  "originCompanyName" TEXT,
  "jobTitle" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "photoUrl" TEXT,
  "notes" TEXT,
  "vehicleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "documentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "documentStatus" "SecurityDocumentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "documentValidUntil" TIMESTAMP(3),
  "restrictions" JSONB,
  "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "lgpdConsentAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityPerson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityContractorCompany" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "tradeName" TEXT,
  "cnpj" TEXT,
  "contractCode" TEXT,
  "managerUserId" TEXT,
  "unitIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "serviceTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requiredDocuments" JSONB,
  "deliveredDocuments" JSONB,
  "documentStatus" "SecurityDocumentStatus" NOT NULL DEFAULT 'MISSING',
  "alertDaysBefore" INTEGER NOT NULL DEFAULT 30,
  "blockReason" TEXT,
  "notes" TEXT,
  "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityContractorCompany_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityVehicle" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "plate" TEXT NOT NULL,
  "model" TEXT,
  "brand" TEXT,
  "color" TEXT,
  "year" INTEGER,
  "companyName" TEXT,
  "ownerName" TEXT,
  "defaultDriverPersonId" TEXT,
  "documentStatus" "SecurityDocumentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "documentValidUntil" TIMESTAMP(3),
  "notes" TEXT,
  "blockReason" TEXT,
  "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityVehicle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityDocumentRequirement" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT,
  "personType" "SecurityPersonType",
  "vehicleType" TEXT,
  "serviceType" TEXT,
  "cargoType" TEXT,
  "criticality" TEXT,
  "name" TEXT NOT NULL,
  "documentKind" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "blockOnMissing" BOOLEAN NOT NULL DEFAULT false,
  "warningDays" INTEGER NOT NULL DEFAULT 30,
  "rules" JSONB,
  "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityDocumentRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityAuthorization" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT,
  "personId" TEXT,
  "contractorCompanyId" TEXT,
  "unitId" TEXT,
  "gateId" TEXT,
  "requestedById" TEXT,
  "internalResponsibleId" TEXT,
  "vehicleId" TEXT,
  "approverId" TEXT,
  "status" "SecurityAuthorizationStatus" NOT NULL DEFAULT 'REQUESTED',
  "source" "SecurityRecordOrigin" NOT NULL DEFAULT 'WEB',
  "reason" TEXT,
  "destinationAreaId" TEXT,
  "scheduledStartAt" TIMESTAMP(3),
  "scheduledEndAt" TIMESTAMP(3),
  "maxStayMinutes" INTEGER,
  "allowedPeriodText" TEXT,
  "passengerPersonIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "materialRefs" JSONB,
  "documentRefs" JSONB,
  "attachments" JSONB,
  "qrCodeToken" TEXT,
  "qrExpiresAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityExternalInvite" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "authorizationId" TEXT,
  "token" TEXT NOT NULL,
  "requesterName" TEXT,
  "requesterEmail" TEXT,
  "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "responseData" JSONB,
  "acceptedTermsAt" TIMESTAMP(3),
  "privacyAcceptedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityExternalInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityAccessMovement" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "unitId" TEXT,
  "gateId" TEXT,
  "postId" TEXT,
  "authorizationId" TEXT,
  "personId" TEXT,
  "vehicleId" TEXT,
  "contractorCompanyId" TEXT,
  "code" TEXT,
  "movementType" "SecurityMovementType" NOT NULL,
  "category" TEXT,
  "documentSnapshot" JSONB,
  "originCompanyName" TEXT,
  "reason" TEXT,
  "internalResponsibleId" TEXT,
  "destinationAreaId" TEXT,
  "plate" TEXT,
  "trailerPlate" TEXT,
  "driverPersonId" TEXT,
  "passengerPersonIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "materialRefs" JSONB,
  "equipmentRefs" JSONB,
  "cargoRefs" JSONB,
  "qrCodeToken" TEXT,
  "expectedEntryAt" TIMESTAMP(3),
  "expectedExitAt" TIMESTAMP(3),
  "entryAt" TIMESTAMP(3),
  "exitAt" TIMESTAMP(3),
  "durationMinutes" INTEGER,
  "maxStayMinutes" INTEGER,
  "status" "SecurityMovementStatus" NOT NULL DEFAULT 'OPEN',
  "exceptionReason" TEXT,
  "exceptionJustification" TEXT,
  "exceptionApprovedById" TEXT,
  "notes" TEXT,
  "attachments" JSONB,
  "photoUrl" TEXT,
  "evidenceRefs" JSONB,
  "registeredById" TEXT,
  "exitRegisteredById" TEXT,
  "origin" "SecurityRecordOrigin" NOT NULL DEFAULT 'WEB',
  "offlineSyncId" TEXT,
  "syncStatus" "SecurityOfflineSyncStatus" NOT NULL DEFAULT 'SYNCED',
  "deviceInfo" JSONB,
  "logs" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityAccessMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityMaterialMovement" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "movementId" TEXT,
  "authorizationId" TEXT,
  "vehicleId" TEXT,
  "driverPersonId" TEXT,
  "responsibleUserId" TEXT,
  "type" "SecurityMovementType" NOT NULL,
  "code" TEXT,
  "description" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION,
  "unit" TEXT,
  "origin" TEXT,
  "destination" TEXT,
  "supplierName" TEXT,
  "carrierName" TEXT,
  "fiscalDocument" TEXT,
  "purchaseOrder" TEXT,
  "workOrder" TEXT,
  "photos" JSONB,
  "documents" JSONB,
  "alertCode" TEXT,
  "status" "SecurityMovementStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityMaterialMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityCustodyItem" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "unitId" TEXT,
  "gateId" TEXT,
  "itemType" "SecurityCustodyItemType" NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "location" TEXT,
  "responsibleUserId" TEXT,
  "holderPersonId" TEXT,
  "holderUserId" TEXT,
  "loanedAt" TIMESTAMP(3),
  "expectedReturnAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "purpose" TEXT,
  "authorizationId" TEXT,
  "notes" TEXT,
  "status" "SecurityCustodyStatus" NOT NULL DEFAULT 'AVAILABLE',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityCustodyItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityCorrespondence" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "unitId" TEXT,
  "gateId" TEXT,
  "sender" TEXT,
  "recipient" TEXT,
  "recipientUserId" TEXT,
  "carrierName" TEXT,
  "trackingCode" TEXT,
  "type" TEXT,
  "receivedById" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pickedUpByName" TEXT,
  "pickedUpById" TEXT,
  "pickedUpAt" TIMESTAMP(3),
  "acknowledgement" TEXT,
  "evidence" JSONB,
  "photoUrl" TEXT,
  "notes" TEXT,
  "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityCorrespondence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityBlocklist" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "personId" TEXT,
  "vehicleId" TEXT,
  "documentNumber" TEXT,
  "plate" TEXT,
  "reason" TEXT NOT NULL,
  "severity" "SecurityIncidentSeverity" NOT NULL DEFAULT 'HIGH',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "evidence" JSONB,
  "notes" TEXT,
  "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityBlocklist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityIncident" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "unitId" TEXT,
  "gateId" TEXT,
  "postId" TEXT,
  "movementId" TEXT,
  "roundExecutionId" TEXT,
  "actionPlanId" TEXT,
  "code" TEXT,
  "title" TEXT NOT NULL,
  "type" TEXT,
  "severity" "SecurityIncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "SecurityIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "description" TEXT,
  "immediateAction" TEXT,
  "rootCauseHypothesis" TEXT,
  "responsibleUserId" TEXT,
  "dueAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "evidence" JSONB,
  "aiSummary" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityRoundRoute" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "unitId" TEXT,
  "gateId" TEXT,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "frequencyMinutes" INTEGER,
  "toleranceMinutes" INTEGER NOT NULL DEFAULT 10,
  "responsibleUserId" TEXT,
  "checklistTemplateId" TEXT,
  "instructions" TEXT,
  "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityRoundRoute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityRoundCheckpoint" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "postId" TEXT,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "qrCodeToken" TEXT,
  "requiredEvidence" BOOLEAN NOT NULL DEFAULT false,
  "instructions" TEXT,
  "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityRoundCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityRoundExecution" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "routeId" TEXT,
  "postId" TEXT,
  "assignedUserId" TEXT,
  "startedById" TEXT,
  "finishedById" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "status" "SecurityRoundStatus" NOT NULL DEFAULT 'PLANNED',
  "visitedCheckpointIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "missedCheckpointIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "checklistSubmissionId" TEXT,
  "evidence" JSONB,
  "offlineSyncId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityRoundExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityShiftHandover" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "unitId" TEXT,
  "gateId" TEXT,
  "postId" TEXT,
  "outgoingUserId" TEXT,
  "incomingUserId" TEXT,
  "shiftName" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "status" "SecurityShiftHandoverStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "summary" TEXT,
  "pendingItems" JSONB,
  "checklistSubmissionId" TEXT,
  "evidence" JSONB,
  "acceptedAt" TIMESTAMP(3),
  "acceptedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityShiftHandover_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityLogBookEntry" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "unitId" TEXT,
  "gateId" TEXT,
  "postId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "title" TEXT NOT NULL,
  "entryType" TEXT NOT NULL,
  "description" TEXT,
  "attachments" JSONB,
  "acknowledgedByIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityLogBookEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityQrCode" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" "SecurityQrStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "issuedById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityQrCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityOfflineSync" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "localId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "operation" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "SecurityOfflineSyncStatus" NOT NULL DEFAULT 'PENDING',
  "conflictReason" TEXT,
  "errorMessage" TEXT,
  "localCreatedAt" TIMESTAMP(3),
  "syncedAt" TIMESTAMP(3),
  "deviceId" TEXT,
  "deviceInfo" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityOfflineSync_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityAuditLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "unitId" TEXT,
  "gateId" TEXT,
  "postId" TEXT,
  "userId" TEXT,
  "userRole" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "recordLabel" TEXT,
  "beforeValue" JSONB,
  "afterValue" JSONB,
  "reason" TEXT,
  "justification" TEXT,
  "approverId" TEXT,
  "evidence" JSONB,
  "origin" "SecurityRecordOrigin" NOT NULL DEFAULT 'WEB',
  "ip" TEXT,
  "deviceInfo" JSONB,
  "offline" BOOLEAN NOT NULL DEFAULT false,
  "syncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityPackageActivation_companyId_idx" ON "SecurityPackageActivation"("companyId");
CREATE INDEX "SecurityPackageActivation_companyId_unitId_idx" ON "SecurityPackageActivation"("companyId", "unitId");
CREATE INDEX "SecurityPackageActivation_companyId_status_idx" ON "SecurityPackageActivation"("companyId", "status");
CREATE UNIQUE INDEX "SecurityGate_companyId_code_key" ON "SecurityGate"("companyId", "code");
CREATE INDEX "SecurityGate_companyId_idx" ON "SecurityGate"("companyId");
CREATE INDEX "SecurityGate_companyId_status_idx" ON "SecurityGate"("companyId", "status");
CREATE INDEX "SecurityGate_branchId_idx" ON "SecurityGate"("branchId");
CREATE INDEX "SecurityGate_unitId_idx" ON "SecurityGate"("unitId");
CREATE UNIQUE INDEX "SecurityPost_companyId_code_key" ON "SecurityPost"("companyId", "code");
CREATE INDEX "SecurityPost_companyId_idx" ON "SecurityPost"("companyId");
CREATE INDEX "SecurityPost_companyId_status_idx" ON "SecurityPost"("companyId", "status");
CREATE INDEX "SecurityPost_gateId_idx" ON "SecurityPost"("gateId");
CREATE INDEX "SecurityPost_unitId_idx" ON "SecurityPost"("unitId");
CREATE INDEX "SecurityPost_routeId_idx" ON "SecurityPost"("routeId");
CREATE INDEX "SecurityPerson_companyId_idx" ON "SecurityPerson"("companyId");
CREATE INDEX "SecurityPerson_companyId_type_idx" ON "SecurityPerson"("companyId", "type");
CREATE INDEX "SecurityPerson_companyId_status_idx" ON "SecurityPerson"("companyId", "status");
CREATE INDEX "SecurityPerson_companyId_documentNumber_idx" ON "SecurityPerson"("companyId", "documentNumber");
CREATE INDEX "SecurityPerson_contractorCompanyId_idx" ON "SecurityPerson"("contractorCompanyId");
CREATE INDEX "SecurityPerson_documentStatus_idx" ON "SecurityPerson"("documentStatus");
CREATE UNIQUE INDEX "SecurityContractorCompany_companyId_cnpj_key" ON "SecurityContractorCompany"("companyId", "cnpj");
CREATE INDEX "SecurityContractorCompany_companyId_idx" ON "SecurityContractorCompany"("companyId");
CREATE INDEX "SecurityContractorCompany_companyId_status_idx" ON "SecurityContractorCompany"("companyId", "status");
CREATE INDEX "SecurityContractorCompany_documentStatus_idx" ON "SecurityContractorCompany"("documentStatus");
CREATE UNIQUE INDEX "SecurityVehicle_companyId_plate_key" ON "SecurityVehicle"("companyId", "plate");
CREATE INDEX "SecurityVehicle_companyId_idx" ON "SecurityVehicle"("companyId");
CREATE INDEX "SecurityVehicle_companyId_status_idx" ON "SecurityVehicle"("companyId", "status");
CREATE INDEX "SecurityVehicle_defaultDriverPersonId_idx" ON "SecurityVehicle"("defaultDriverPersonId");
CREATE INDEX "SecurityVehicle_documentStatus_idx" ON "SecurityVehicle"("documentStatus");
CREATE INDEX "SecurityDocumentRequirement_companyId_idx" ON "SecurityDocumentRequirement"("companyId");
CREATE INDEX "SecurityDocumentRequirement_companyId_scopeType_idx" ON "SecurityDocumentRequirement"("companyId", "scopeType");
CREATE INDEX "SecurityDocumentRequirement_companyId_status_idx" ON "SecurityDocumentRequirement"("companyId", "status");
CREATE UNIQUE INDEX "SecurityAuthorization_companyId_code_key" ON "SecurityAuthorization"("companyId", "code");
CREATE INDEX "SecurityAuthorization_companyId_idx" ON "SecurityAuthorization"("companyId");
CREATE INDEX "SecurityAuthorization_companyId_status_idx" ON "SecurityAuthorization"("companyId", "status");
CREATE INDEX "SecurityAuthorization_personId_idx" ON "SecurityAuthorization"("personId");
CREATE INDEX "SecurityAuthorization_vehicleId_idx" ON "SecurityAuthorization"("vehicleId");
CREATE INDEX "SecurityAuthorization_gateId_idx" ON "SecurityAuthorization"("gateId");
CREATE INDEX "SecurityAuthorization_scheduledStartAt_scheduledEndAt_idx" ON "SecurityAuthorization"("scheduledStartAt", "scheduledEndAt");
CREATE UNIQUE INDEX "SecurityExternalInvite_token_key" ON "SecurityExternalInvite"("token");
CREATE INDEX "SecurityExternalInvite_companyId_idx" ON "SecurityExternalInvite"("companyId");
CREATE INDEX "SecurityExternalInvite_authorizationId_idx" ON "SecurityExternalInvite"("authorizationId");
CREATE INDEX "SecurityExternalInvite_status_expiresAt_idx" ON "SecurityExternalInvite"("status", "expiresAt");
CREATE UNIQUE INDEX "SecurityAccessMovement_companyId_code_key" ON "SecurityAccessMovement"("companyId", "code");
CREATE INDEX "SecurityAccessMovement_companyId_idx" ON "SecurityAccessMovement"("companyId");
CREATE INDEX "SecurityAccessMovement_companyId_status_idx" ON "SecurityAccessMovement"("companyId", "status");
CREATE INDEX "SecurityAccessMovement_companyId_movementType_idx" ON "SecurityAccessMovement"("companyId", "movementType");
CREATE INDEX "SecurityAccessMovement_gateId_idx" ON "SecurityAccessMovement"("gateId");
CREATE INDEX "SecurityAccessMovement_postId_idx" ON "SecurityAccessMovement"("postId");
CREATE INDEX "SecurityAccessMovement_personId_idx" ON "SecurityAccessMovement"("personId");
CREATE INDEX "SecurityAccessMovement_vehicleId_idx" ON "SecurityAccessMovement"("vehicleId");
CREATE INDEX "SecurityAccessMovement_entryAt_idx" ON "SecurityAccessMovement"("entryAt");
CREATE INDEX "SecurityAccessMovement_exitAt_idx" ON "SecurityAccessMovement"("exitAt");
CREATE INDEX "SecurityAccessMovement_expectedExitAt_idx" ON "SecurityAccessMovement"("expectedExitAt");
CREATE INDEX "SecurityMaterialMovement_companyId_idx" ON "SecurityMaterialMovement"("companyId");
CREATE INDEX "SecurityMaterialMovement_companyId_status_idx" ON "SecurityMaterialMovement"("companyId", "status");
CREATE INDEX "SecurityMaterialMovement_movementId_idx" ON "SecurityMaterialMovement"("movementId");
CREATE INDEX "SecurityMaterialMovement_authorizationId_idx" ON "SecurityMaterialMovement"("authorizationId");
CREATE INDEX "SecurityMaterialMovement_occurredAt_idx" ON "SecurityMaterialMovement"("occurredAt");
CREATE UNIQUE INDEX "SecurityCustodyItem_companyId_code_key" ON "SecurityCustodyItem"("companyId", "code");
CREATE INDEX "SecurityCustodyItem_companyId_idx" ON "SecurityCustodyItem"("companyId");
CREATE INDEX "SecurityCustodyItem_companyId_itemType_idx" ON "SecurityCustodyItem"("companyId", "itemType");
CREATE INDEX "SecurityCustodyItem_companyId_status_idx" ON "SecurityCustodyItem"("companyId", "status");
CREATE INDEX "SecurityCustodyItem_holderPersonId_idx" ON "SecurityCustodyItem"("holderPersonId");
CREATE INDEX "SecurityCustodyItem_expectedReturnAt_idx" ON "SecurityCustodyItem"("expectedReturnAt");
CREATE INDEX "SecurityCorrespondence_companyId_idx" ON "SecurityCorrespondence"("companyId");
CREATE INDEX "SecurityCorrespondence_companyId_status_idx" ON "SecurityCorrespondence"("companyId", "status");
CREATE INDEX "SecurityCorrespondence_gateId_idx" ON "SecurityCorrespondence"("gateId");
CREATE INDEX "SecurityCorrespondence_trackingCode_idx" ON "SecurityCorrespondence"("trackingCode");
CREATE INDEX "SecurityCorrespondence_receivedAt_idx" ON "SecurityCorrespondence"("receivedAt");
CREATE INDEX "SecurityBlocklist_companyId_idx" ON "SecurityBlocklist"("companyId");
CREATE INDEX "SecurityBlocklist_companyId_status_idx" ON "SecurityBlocklist"("companyId", "status");
CREATE INDEX "SecurityBlocklist_personId_idx" ON "SecurityBlocklist"("personId");
CREATE INDEX "SecurityBlocklist_vehicleId_idx" ON "SecurityBlocklist"("vehicleId");
CREATE INDEX "SecurityBlocklist_documentNumber_idx" ON "SecurityBlocklist"("documentNumber");
CREATE INDEX "SecurityBlocklist_plate_idx" ON "SecurityBlocklist"("plate");
CREATE UNIQUE INDEX "SecurityIncident_companyId_code_key" ON "SecurityIncident"("companyId", "code");
CREATE INDEX "SecurityIncident_companyId_idx" ON "SecurityIncident"("companyId");
CREATE INDEX "SecurityIncident_companyId_status_idx" ON "SecurityIncident"("companyId", "status");
CREATE INDEX "SecurityIncident_companyId_severity_idx" ON "SecurityIncident"("companyId", "severity");
CREATE INDEX "SecurityIncident_gateId_idx" ON "SecurityIncident"("gateId");
CREATE INDEX "SecurityIncident_postId_idx" ON "SecurityIncident"("postId");
CREATE INDEX "SecurityIncident_dueAt_idx" ON "SecurityIncident"("dueAt");
CREATE UNIQUE INDEX "SecurityRoundRoute_companyId_code_key" ON "SecurityRoundRoute"("companyId", "code");
CREATE INDEX "SecurityRoundRoute_companyId_idx" ON "SecurityRoundRoute"("companyId");
CREATE INDEX "SecurityRoundRoute_companyId_status_idx" ON "SecurityRoundRoute"("companyId", "status");
CREATE INDEX "SecurityRoundRoute_gateId_idx" ON "SecurityRoundRoute"("gateId");
CREATE INDEX "SecurityRoundRoute_unitId_idx" ON "SecurityRoundRoute"("unitId");
CREATE INDEX "SecurityRoundCheckpoint_companyId_idx" ON "SecurityRoundCheckpoint"("companyId");
CREATE INDEX "SecurityRoundCheckpoint_routeId_idx" ON "SecurityRoundCheckpoint"("routeId");
CREATE INDEX "SecurityRoundCheckpoint_postId_idx" ON "SecurityRoundCheckpoint"("postId");
CREATE INDEX "SecurityRoundCheckpoint_status_idx" ON "SecurityRoundCheckpoint"("status");
CREATE INDEX "SecurityRoundExecution_companyId_idx" ON "SecurityRoundExecution"("companyId");
CREATE INDEX "SecurityRoundExecution_companyId_status_idx" ON "SecurityRoundExecution"("companyId", "status");
CREATE INDEX "SecurityRoundExecution_routeId_idx" ON "SecurityRoundExecution"("routeId");
CREATE INDEX "SecurityRoundExecution_postId_idx" ON "SecurityRoundExecution"("postId");
CREATE INDEX "SecurityRoundExecution_scheduledAt_idx" ON "SecurityRoundExecution"("scheduledAt");
CREATE INDEX "SecurityShiftHandover_companyId_idx" ON "SecurityShiftHandover"("companyId");
CREATE INDEX "SecurityShiftHandover_companyId_status_idx" ON "SecurityShiftHandover"("companyId", "status");
CREATE INDEX "SecurityShiftHandover_gateId_idx" ON "SecurityShiftHandover"("gateId");
CREATE INDEX "SecurityShiftHandover_postId_idx" ON "SecurityShiftHandover"("postId");
CREATE INDEX "SecurityShiftHandover_startedAt_idx" ON "SecurityShiftHandover"("startedAt");
CREATE INDEX "SecurityLogBookEntry_companyId_idx" ON "SecurityLogBookEntry"("companyId");
CREATE INDEX "SecurityLogBookEntry_companyId_status_idx" ON "SecurityLogBookEntry"("companyId", "status");
CREATE INDEX "SecurityLogBookEntry_gateId_idx" ON "SecurityLogBookEntry"("gateId");
CREATE INDEX "SecurityLogBookEntry_postId_idx" ON "SecurityLogBookEntry"("postId");
CREATE INDEX "SecurityLogBookEntry_occurredAt_idx" ON "SecurityLogBookEntry"("occurredAt");
CREATE UNIQUE INDEX "SecurityQrCode_token_key" ON "SecurityQrCode"("token");
CREATE INDEX "SecurityQrCode_companyId_idx" ON "SecurityQrCode"("companyId");
CREATE INDEX "SecurityQrCode_companyId_entityType_entityId_idx" ON "SecurityQrCode"("companyId", "entityType", "entityId");
CREATE INDEX "SecurityQrCode_status_idx" ON "SecurityQrCode"("status");
CREATE INDEX "SecurityQrCode_expiresAt_idx" ON "SecurityQrCode"("expiresAt");
CREATE UNIQUE INDEX "SecurityOfflineSync_companyId_localId_key" ON "SecurityOfflineSync"("companyId", "localId");
CREATE INDEX "SecurityOfflineSync_companyId_idx" ON "SecurityOfflineSync"("companyId");
CREATE INDEX "SecurityOfflineSync_companyId_status_idx" ON "SecurityOfflineSync"("companyId", "status");
CREATE INDEX "SecurityOfflineSync_entityType_entityId_idx" ON "SecurityOfflineSync"("entityType", "entityId");
CREATE INDEX "SecurityAuditLog_companyId_createdAt_idx" ON "SecurityAuditLog"("companyId", "createdAt");
CREATE INDEX "SecurityAuditLog_userId_createdAt_idx" ON "SecurityAuditLog"("userId", "createdAt");
CREATE INDEX "SecurityAuditLog_entity_entityId_idx" ON "SecurityAuditLog"("entity", "entityId");
CREATE INDEX "SecurityAuditLog_gateId_idx" ON "SecurityAuditLog"("gateId");
CREATE INDEX "SecurityAuditLog_postId_idx" ON "SecurityAuditLog"("postId");

ALTER TABLE "SecurityPackageActivation" ADD CONSTRAINT "SecurityPackageActivation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityPackageActivation" ADD CONSTRAINT "SecurityPackageActivation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityGate" ADD CONSTRAINT "SecurityGate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityGate" ADD CONSTRAINT "SecurityGate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityGate" ADD CONSTRAINT "SecurityGate_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityPost" ADD CONSTRAINT "SecurityPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityPost" ADD CONSTRAINT "SecurityPost_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityPost" ADD CONSTRAINT "SecurityPost_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "SecurityGate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityPerson" ADD CONSTRAINT "SecurityPerson_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityPerson" ADD CONSTRAINT "SecurityPerson_contractorCompanyId_fkey" FOREIGN KEY ("contractorCompanyId") REFERENCES "SecurityContractorCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityContractorCompany" ADD CONSTRAINT "SecurityContractorCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityVehicle" ADD CONSTRAINT "SecurityVehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityVehicle" ADD CONSTRAINT "SecurityVehicle_defaultDriverPersonId_fkey" FOREIGN KEY ("defaultDriverPersonId") REFERENCES "SecurityPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityDocumentRequirement" ADD CONSTRAINT "SecurityDocumentRequirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityAuthorization" ADD CONSTRAINT "SecurityAuthorization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityAuthorization" ADD CONSTRAINT "SecurityAuthorization_personId_fkey" FOREIGN KEY ("personId") REFERENCES "SecurityPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAuthorization" ADD CONSTRAINT "SecurityAuthorization_contractorCompanyId_fkey" FOREIGN KEY ("contractorCompanyId") REFERENCES "SecurityContractorCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAuthorization" ADD CONSTRAINT "SecurityAuthorization_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAuthorization" ADD CONSTRAINT "SecurityAuthorization_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "SecurityGate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAuthorization" ADD CONSTRAINT "SecurityAuthorization_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "SecurityVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityExternalInvite" ADD CONSTRAINT "SecurityExternalInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityExternalInvite" ADD CONSTRAINT "SecurityExternalInvite_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "SecurityAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAccessMovement" ADD CONSTRAINT "SecurityAccessMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityAccessMovement" ADD CONSTRAINT "SecurityAccessMovement_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAccessMovement" ADD CONSTRAINT "SecurityAccessMovement_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "SecurityGate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAccessMovement" ADD CONSTRAINT "SecurityAccessMovement_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SecurityPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAccessMovement" ADD CONSTRAINT "SecurityAccessMovement_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "SecurityAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAccessMovement" ADD CONSTRAINT "SecurityAccessMovement_personId_fkey" FOREIGN KEY ("personId") REFERENCES "SecurityPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAccessMovement" ADD CONSTRAINT "SecurityAccessMovement_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "SecurityVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAccessMovement" ADD CONSTRAINT "SecurityAccessMovement_contractorCompanyId_fkey" FOREIGN KEY ("contractorCompanyId") REFERENCES "SecurityContractorCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityMaterialMovement" ADD CONSTRAINT "SecurityMaterialMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityMaterialMovement" ADD CONSTRAINT "SecurityMaterialMovement_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "SecurityAccessMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityMaterialMovement" ADD CONSTRAINT "SecurityMaterialMovement_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "SecurityAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityMaterialMovement" ADD CONSTRAINT "SecurityMaterialMovement_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "SecurityVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityMaterialMovement" ADD CONSTRAINT "SecurityMaterialMovement_driverPersonId_fkey" FOREIGN KEY ("driverPersonId") REFERENCES "SecurityPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityCustodyItem" ADD CONSTRAINT "SecurityCustodyItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityCustodyItem" ADD CONSTRAINT "SecurityCustodyItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityCustodyItem" ADD CONSTRAINT "SecurityCustodyItem_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "SecurityGate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityCustodyItem" ADD CONSTRAINT "SecurityCustodyItem_holderPersonId_fkey" FOREIGN KEY ("holderPersonId") REFERENCES "SecurityPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityCustodyItem" ADD CONSTRAINT "SecurityCustodyItem_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "SecurityAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityCorrespondence" ADD CONSTRAINT "SecurityCorrespondence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityCorrespondence" ADD CONSTRAINT "SecurityCorrespondence_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityCorrespondence" ADD CONSTRAINT "SecurityCorrespondence_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "SecurityGate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityBlocklist" ADD CONSTRAINT "SecurityBlocklist_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityBlocklist" ADD CONSTRAINT "SecurityBlocklist_personId_fkey" FOREIGN KEY ("personId") REFERENCES "SecurityPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityBlocklist" ADD CONSTRAINT "SecurityBlocklist_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "SecurityVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "SecurityGate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SecurityPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "SecurityAccessMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityRoundRoute" ADD CONSTRAINT "SecurityRoundRoute_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityRoundRoute" ADD CONSTRAINT "SecurityRoundRoute_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityRoundRoute" ADD CONSTRAINT "SecurityRoundRoute_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "SecurityGate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityRoundCheckpoint" ADD CONSTRAINT "SecurityRoundCheckpoint_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityRoundCheckpoint" ADD CONSTRAINT "SecurityRoundCheckpoint_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "SecurityRoundRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityRoundCheckpoint" ADD CONSTRAINT "SecurityRoundCheckpoint_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SecurityPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityRoundExecution" ADD CONSTRAINT "SecurityRoundExecution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityRoundExecution" ADD CONSTRAINT "SecurityRoundExecution_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "SecurityRoundRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityRoundExecution" ADD CONSTRAINT "SecurityRoundExecution_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SecurityPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityShiftHandover" ADD CONSTRAINT "SecurityShiftHandover_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityShiftHandover" ADD CONSTRAINT "SecurityShiftHandover_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityShiftHandover" ADD CONSTRAINT "SecurityShiftHandover_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "SecurityGate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityShiftHandover" ADD CONSTRAINT "SecurityShiftHandover_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SecurityPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityLogBookEntry" ADD CONSTRAINT "SecurityLogBookEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityLogBookEntry" ADD CONSTRAINT "SecurityLogBookEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityLogBookEntry" ADD CONSTRAINT "SecurityLogBookEntry_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "SecurityGate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityLogBookEntry" ADD CONSTRAINT "SecurityLogBookEntry_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SecurityPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityQrCode" ADD CONSTRAINT "SecurityQrCode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityOfflineSync" ADD CONSTRAINT "SecurityOfflineSync_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityAuditLog" ADD CONSTRAINT "SecurityAuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
