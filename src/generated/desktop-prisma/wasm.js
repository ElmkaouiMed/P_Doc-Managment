
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.21.1
 * Query Engine version: bf0e5e8a04cada8225617067eaa03d041e2bba36
 */
Prisma.prismaVersion = {
  client: "5.21.1",
  engine: "bf0e5e8a04cada8225617067eaa03d041e2bba36"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  fullName: 'fullName',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CompanyScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  defaultCurrency: 'defaultCurrency',
  accountStatus: 'accountStatus',
  trialStartedAt: 'trialStartedAt',
  trialEndsAt: 'trialEndsAt',
  graceEndsAt: 'graceEndsAt',
  awaitingActivationAt: 'awaitingActivationAt',
  activatedAt: 'activatedAt',
  lockedAt: 'lockedAt',
  lockReason: 'lockReason',
  statusNote: 'statusNote',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CompanyMembershipScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  userId: 'userId',
  role: 'role',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CompanyProfileScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  legalName: 'legalName',
  ice: 'ice',
  ifNumber: 'ifNumber',
  rcNumber: 'rcNumber',
  cnssNumber: 'cnssNumber',
  phoneFix: 'phoneFix',
  phoneMobile: 'phoneMobile',
  email: 'email',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  city: 'city',
  country: 'country',
  zipCode: 'zipCode',
  bankName: 'bankName',
  iban: 'iban',
  swift: 'swift',
  taxRateDefault: 'taxRateDefault',
  website: 'website',
  logoUrl: 'logoUrl',
  signatureUrl: 'signatureUrl',
  extraJson: 'extraJson',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NumberingSequenceScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  documentType: 'documentType',
  prefix: 'prefix',
  format: 'format',
  nextValue: 'nextValue',
  resetYearly: 'resetYearly',
  currentYear: 'currentYear',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClientScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  code: 'code',
  name: 'name',
  email: 'email',
  phone: 'phone',
  phoneFix: 'phoneFix',
  address: 'address',
  city: 'city',
  country: 'country',
  ice: 'ice',
  ifNumber: 'ifNumber',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  sku: 'sku',
  name: 'name',
  description: 'description',
  unit: 'unit',
  priceHT: 'priceHT',
  vatRate: 'vatRate',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DocumentScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  createdById: 'createdById',
  clientId: 'clientId',
  documentType: 'documentType',
  documentNumber: 'documentNumber',
  status: 'status',
  title: 'title',
  issueDate: 'issueDate',
  dueDate: 'dueDate',
  language: 'language',
  currency: 'currency',
  subtotalHT: 'subtotalHT',
  totalTax: 'totalTax',
  totalTTC: 'totalTTC',
  amountPaid: 'amountPaid',
  amountDue: 'amountDue',
  notes: 'notes',
  terms: 'terms',
  metadataJson: 'metadataJson',
  convertedFromId: 'convertedFromId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DocumentTypePayloadScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  documentId: 'documentId',
  payloadJson: 'payloadJson',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DocumentLineItemScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  documentId: 'documentId',
  productId: 'productId',
  sortOrder: 'sortOrder',
  label: 'label',
  description: 'description',
  sku: 'sku',
  unit: 'unit',
  quantity: 'quantity',
  unitPriceHT: 'unitPriceHT',
  discountRate: 'discountRate',
  vatRate: 'vatRate',
  lineSubtotalHT: 'lineSubtotalHT',
  lineTotalTTC: 'lineTotalTTC',
  snapshotJson: 'snapshotJson',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DocumentRelationScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  sourceDocumentId: 'sourceDocumentId',
  targetDocumentId: 'targetDocumentId',
  relationType: 'relationType',
  mappingJson: 'mappingJson',
  createdAt: 'createdAt'
};

exports.Prisma.DocumentStatusEventScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  documentId: 'documentId',
  actorId: 'actorId',
  fromStatus: 'fromStatus',
  toStatus: 'toStatus',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.DocumentAttachmentScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  documentId: 'documentId',
  fileName: 'fileName',
  mimeType: 'mimeType',
  filePath: 'filePath',
  fileSize: 'fileSize',
  createdAt: 'createdAt'
};

exports.Prisma.TemplateScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  documentType: 'documentType',
  name: 'name',
  description: 'description',
  templateFormat: 'templateFormat',
  isDefault: 'isDefault',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TemplateVersionScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  templateId: 'templateId',
  versionNumber: 'versionNumber',
  engineName: 'engineName',
  sourcePath: 'sourcePath',
  sourceJson: 'sourceJson',
  configJson: 'configJson',
  variablesJson: 'variablesJson',
  isPublished: 'isPublished',
  createdAt: 'createdAt'
};

exports.Prisma.ExportJobScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  documentId: 'documentId',
  templateId: 'templateId',
  templateVersionId: 'templateVersionId',
  exportFormat: 'exportFormat',
  status: 'status',
  outputPath: 'outputPath',
  errorMessage: 'errorMessage',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  createdAt: 'createdAt'
};

exports.Prisma.ImportJobScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  createdById: 'createdById',
  importType: 'importType',
  sourceFileName: 'sourceFileName',
  sourceFilePath: 'sourceFilePath',
  status: 'status',
  errorMessage: 'errorMessage',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ImportJobResultScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  importJobId: 'importJobId',
  extractedType: 'extractedType',
  confidenceScore: 'confidenceScore',
  extractedJson: 'extractedJson',
  normalizedJson: 'normalizedJson',
  warningJson: 'warningJson',
  createdAt: 'createdAt'
};

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  clientId: 'clientId',
  createdById: 'createdById',
  paymentDate: 'paymentDate',
  amount: 'amount',
  method: 'method',
  reference: 'reference',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaymentAllocationScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  paymentId: 'paymentId',
  documentId: 'documentId',
  amountAllocated: 'amountAllocated',
  createdAt: 'createdAt'
};

exports.Prisma.PaymentProofScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  submittedById: 'submittedById',
  reviewedById: 'reviewedById',
  method: 'method',
  status: 'status',
  amount: 'amount',
  currency: 'currency',
  reference: 'reference',
  proofFilePath: 'proofFilePath',
  note: 'note',
  reviewNote: 'reviewNote',
  metadataJson: 'metadataJson',
  submittedAt: 'submittedAt',
  reviewedAt: 'reviewedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CompanyAccountStatusEventScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  actorId: 'actorId',
  fromStatus: 'fromStatus',
  toStatus: 'toStatus',
  reason: 'reason',
  metadataJson: 'metadataJson',
  createdAt: 'createdAt'
};

exports.Prisma.NotificationRuleScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  isEnabled: 'isEnabled',
  notificationType: 'notificationType',
  channel: 'channel',
  daysBeforeDue: 'daysBeforeDue',
  daysAfterDue: 'daysAfterDue',
  sendTime: 'sendTime',
  templateSubject: 'templateSubject',
  templateBody: 'templateBody',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NotificationEventScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  documentId: 'documentId',
  notificationType: 'notificationType',
  channel: 'channel',
  status: 'status',
  eventKey: 'eventKey',
  recipient: 'recipient',
  title: 'title',
  body: 'body',
  actionPath: 'actionPath',
  metadataJson: 'metadataJson',
  sentAt: 'sentAt',
  errorMessage: 'errorMessage',
  createdAt: 'createdAt'
};

exports.Prisma.NotificationReadScalarFieldEnum = {
  id: 'id',
  notificationEventId: 'notificationEventId',
  userId: 'userId',
  readAt: 'readAt'
};

exports.Prisma.CompanySettingScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  key: 'key',
  valueJson: 'valueJson',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlatformUserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  fullName: 'fullName',
  role: 'role',
  isActive: 'isActive',
  lastLoginAt: 'lastLoginAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlatformSessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  tokenHash: 'tokenHash',
  expiresAt: 'expiresAt',
  lastUsedAt: 'lastUsedAt',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  revokedAt: 'revokedAt',
  revokeReason: 'revokeReason',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlatformMfaSecretScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  secretEncrypted: 'secretEncrypted',
  backupCodesHash: 'backupCodesHash',
  isPrimary: 'isPrimary',
  verifiedAt: 'verifiedAt',
  lastUsedAt: 'lastUsedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlatformAuditLogScalarFieldEnum = {
  id: 'id',
  actorId: 'actorId',
  action: 'action',
  entityType: 'entityType',
  entityId: 'entityId',
  companyId: 'companyId',
  metadataJson: 'metadataJson',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  createdAt: 'createdAt'
};

exports.Prisma.PlanDefinitionScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  description: 'description',
  monthlyPrice: 'monthlyPrice',
  yearlyPrice: 'yearlyPrice',
  currency: 'currency',
  isActive: 'isActive',
  metadataJson: 'metadataJson',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlanLimitScalarFieldEnum = {
  id: 'id',
  planId: 'planId',
  key: 'key',
  valueInt: 'valueInt',
  valueDecimal: 'valueDecimal',
  valueText: 'valueText',
  isUnlimited: 'isUnlimited',
  metadataJson: 'metadataJson',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CompanySubscriptionScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  planId: 'planId',
  status: 'status',
  billingCycle: 'billingCycle',
  priceAmount: 'priceAmount',
  currency: 'currency',
  startedAt: 'startedAt',
  trialEndsAt: 'trialEndsAt',
  currentPeriodStart: 'currentPeriodStart',
  currentPeriodEnd: 'currentPeriodEnd',
  canceledAt: 'canceledAt',
  metadataJson: 'metadataJson',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ReclamationScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  createdByUserId: 'createdByUserId',
  assignedToId: 'assignedToId',
  status: 'status',
  priority: 'priority',
  category: 'category',
  subject: 'subject',
  description: 'description',
  channel: 'channel',
  slaDeadlineAt: 'slaDeadlineAt',
  firstResponseAt: 'firstResponseAt',
  resolvedAt: 'resolvedAt',
  closedAt: 'closedAt',
  metadataJson: 'metadataJson',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ReclamationMessageScalarFieldEnum = {
  id: 'id',
  reclamationId: 'reclamationId',
  authorType: 'authorType',
  authorUserId: 'authorUserId',
  authorPlatformUserId: 'authorPlatformUserId',
  body: 'body',
  attachmentsJson: 'attachmentsJson',
  isInternalNote: 'isInternalNote',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  User: 'User',
  Company: 'Company',
  CompanyMembership: 'CompanyMembership',
  CompanyProfile: 'CompanyProfile',
  NumberingSequence: 'NumberingSequence',
  Client: 'Client',
  Product: 'Product',
  Document: 'Document',
  DocumentTypePayload: 'DocumentTypePayload',
  DocumentLineItem: 'DocumentLineItem',
  DocumentRelation: 'DocumentRelation',
  DocumentStatusEvent: 'DocumentStatusEvent',
  DocumentAttachment: 'DocumentAttachment',
  Template: 'Template',
  TemplateVersion: 'TemplateVersion',
  ExportJob: 'ExportJob',
  ImportJob: 'ImportJob',
  ImportJobResult: 'ImportJobResult',
  Payment: 'Payment',
  PaymentAllocation: 'PaymentAllocation',
  PaymentProof: 'PaymentProof',
  CompanyAccountStatusEvent: 'CompanyAccountStatusEvent',
  NotificationRule: 'NotificationRule',
  NotificationEvent: 'NotificationEvent',
  NotificationRead: 'NotificationRead',
  CompanySetting: 'CompanySetting',
  PlatformUser: 'PlatformUser',
  PlatformSession: 'PlatformSession',
  PlatformMfaSecret: 'PlatformMfaSecret',
  PlatformAuditLog: 'PlatformAuditLog',
  PlanDefinition: 'PlanDefinition',
  PlanLimit: 'PlanLimit',
  CompanySubscription: 'CompanySubscription',
  Reclamation: 'Reclamation',
  ReclamationMessage: 'ReclamationMessage'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
