-- AlterTable
ALTER TABLE `Company`
  ADD COLUMN `accountStatus` ENUM('TRIAL_ACTIVE', 'TRIAL_EXPIRED', 'GRACE', 'AWAITING_ACTIVATION', 'ACTIVE_PAID', 'LOCKED') NOT NULL DEFAULT 'ACTIVE_PAID',
  ADD COLUMN `trialStartedAt` DATETIME(3) NULL,
  ADD COLUMN `trialEndsAt` DATETIME(3) NULL,
  ADD COLUMN `graceEndsAt` DATETIME(3) NULL,
  ADD COLUMN `awaitingActivationAt` DATETIME(3) NULL,
  ADD COLUMN `activatedAt` DATETIME(3) NULL,
  ADD COLUMN `lockedAt` DATETIME(3) NULL,
  ADD COLUMN `lockReason` VARCHAR(191) NULL,
  ADD COLUMN `statusNote` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `PaymentProof` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `submittedById` VARCHAR(191) NOT NULL,
  `reviewedById` VARCHAR(191) NULL,
  `method` ENUM('VIREMENT', 'WAFACASH', 'CASH', 'OTHER') NOT NULL,
  `status` ENUM('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'SUBMITTED',
  `amount` DECIMAL(14, 2) NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'MAD',
  `reference` VARCHAR(191) NULL,
  `proofFilePath` VARCHAR(191) NULL,
  `note` VARCHAR(191) NULL,
  `reviewNote` VARCHAR(191) NULL,
  `metadataJson` JSON NULL,
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `PaymentProof_companyId_status_submittedAt_idx`(`companyId`, `status`, `submittedAt`),
  INDEX `PaymentProof_companyId_submittedById_createdAt_idx`(`companyId`, `submittedById`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyAccountStatusEvent` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NULL,
  `fromStatus` ENUM('TRIAL_ACTIVE', 'TRIAL_EXPIRED', 'GRACE', 'AWAITING_ACTIVATION', 'ACTIVE_PAID', 'LOCKED') NULL,
  `toStatus` ENUM('TRIAL_ACTIVE', 'TRIAL_EXPIRED', 'GRACE', 'AWAITING_ACTIVATION', 'ACTIVE_PAID', 'LOCKED') NOT NULL,
  `reason` VARCHAR(191) NULL,
  `metadataJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `CompanyAccountStatusEvent_companyId_createdAt_idx`(`companyId`, `createdAt`),
  INDEX `CompanyAccountStatusEvent_companyId_toStatus_createdAt_idx`(`companyId`, `toStatus`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PaymentProof` ADD CONSTRAINT `PaymentProof_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentProof` ADD CONSTRAINT `PaymentProof_submittedById_fkey`
  FOREIGN KEY (`submittedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentProof` ADD CONSTRAINT `PaymentProof_reviewedById_fkey`
  FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyAccountStatusEvent` ADD CONSTRAINT `CompanyAccountStatusEvent_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyAccountStatusEvent` ADD CONSTRAINT `CompanyAccountStatusEvent_actorId_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
