-- Alter notification enums on existing tables
ALTER TABLE `NotificationRule`
  MODIFY `notificationType` ENUM('DUE_SOON', 'OVERDUE', 'DRAFT_STALE', 'STATUS_CHANGED', 'EMAIL_FAILED', 'EXPORT_FAILED') NOT NULL,
  MODIFY `channel` ENUM('IN_APP', 'EMAIL', 'PUSH') NOT NULL DEFAULT 'EMAIL';

ALTER TABLE `NotificationEvent`
  MODIFY `notificationType` ENUM('DUE_SOON', 'OVERDUE', 'DRAFT_STALE', 'STATUS_CHANGED', 'EMAIL_FAILED', 'EXPORT_FAILED') NOT NULL,
  MODIFY `channel` ENUM('IN_APP', 'EMAIL', 'PUSH') NOT NULL,
  ADD COLUMN `eventKey` VARCHAR(191) NULL,
  ADD COLUMN `title` VARCHAR(191) NULL,
  ADD COLUMN `body` VARCHAR(191) NULL,
  ADD COLUMN `actionPath` VARCHAR(191) NULL,
  ADD COLUMN `metadataJson` JSON NULL;

-- CreateTable
CREATE TABLE `NotificationRead` (
  `id` VARCHAR(191) NOT NULL,
  `notificationEventId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `NotificationRead_notificationEventId_userId_key`(`notificationEventId`, `userId`),
  INDEX `NotificationRead_userId_readAt_idx`(`userId`, `readAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddIndex
CREATE UNIQUE INDEX `NotificationEvent_companyId_eventKey_key` ON `NotificationEvent`(`companyId`, `eventKey`);

-- AddForeignKey
ALTER TABLE `NotificationRead` ADD CONSTRAINT `NotificationRead_notificationEventId_fkey`
  FOREIGN KEY (`notificationEventId`) REFERENCES `NotificationEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationRead` ADD CONSTRAINT `NotificationRead_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
