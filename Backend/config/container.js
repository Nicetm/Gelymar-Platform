const { createContainer, asValue, asFunction } = require('awilix');
const { poolPromise } = require('./db');
const { sql, getSqlPool } = require('./sqlserver');
const { mapHdrRowToOrder } = require('../mappers/sqlsoftkey/hdr.mapper');
const { mapFactRowToInvoice } = require('../mappers/sqlsoftkey/fact.mapper');
const { mapItemRowToOrderItem } = require('../mappers/sqlsoftkey/item.mapper');
const { logger } = require('../utils/logger');
const { createOrderService } = require('../services/order.service');
const { createAdminNotificationSummaryService } = require('../services/adminNotificationSummary.service');
const { createProjectionService } = require('../services/projection.service');
const PasswordService = require('../services/password.service');
const AuthService = require('../services/auth.service');
const Auth2FAService = require('../services/auth2fa.service');
const chatService = require('../services/chat.service');
const checkAvailabilityNoticeService = require('../services/checkAvailabilityNotice.service');
const checkClientAccessService = require('../services/checkClientAccess.service');
const checkDefaultFilesService = require('../services/checkDefaultFiles.service');
const checkOrderDeliveryNoticeService = require('../services/checkOrderDeliveryNotice.service');
const checkOrderReceptionService = require('../services/checkOrderReception.service');
const checkShipmentNoticeService = require('../services/checkShipmentNotice.service');
const configService = require('../services/config.service');
const cronConfigService = require('../services/cronConfig.service');
const customerService = require('../services/customer.service');
const documentFileService = require('../services/documentFile.service');
const documentEventService = require('../services/documentEvent.service');
const emailService = require('../services/email.service');
const encryptionService = require('../services/encryption.service');
const fileService = require('../services/file.service');
const folderService = require('../services/folder.service');
const itemService = require('../services/item.service');
const messageService = require('../services/message.service');
const monitoringService = require('../services/monitoring.service');
const orderDetailService = require('../services/orderDetail.service');
const orderItemService = require('../services/orderItem.service');
const userAvatarService = require('../services/user_avatar.service');
const userService = require('../services/user.service');
const vendedorService = require('../services/vendedor.service');

const container = createContainer();

container.register({
  mysqlPoolPromise: asValue(poolPromise),
  sqlModule: asValue(sql),
  getSqlPoolFn: asValue(getSqlPool),
  hdrMapper: asValue(mapHdrRowToOrder),
  factMapper: asValue(mapFactRowToInvoice),
  itemMapper: asValue(mapItemRowToOrderItem),
  logger: asValue(logger),
  orderService: asFunction((deps) => createOrderService(deps)).singleton(),
  adminNotificationSummaryService: asFunction((deps) => createAdminNotificationSummaryService(deps)).singleton(),
  projectionService: asFunction((deps) => createProjectionService(deps)).singleton(),
  passwordService: asFunction(() => new PasswordService({
    mysqlPoolPromise: container.resolve('mysqlPoolPromise'),
    logger: container.resolve('logger')
  })).singleton(),
  authService: asFunction(() => new AuthService({
    mysqlPoolPromise: container.resolve('mysqlPoolPromise'),
    logger: container.resolve('logger')
  })).singleton(),
  auth2faService: asFunction(() => new Auth2FAService({
    mysqlPoolPromise: container.resolve('mysqlPoolPromise'),
    logger: container.resolve('logger')
  })).singleton(),
  chatService: asValue(chatService),
  checkAvailabilityNoticeService: asValue(checkAvailabilityNoticeService),
  checkClientAccessService: asValue(checkClientAccessService),
  checkDefaultFilesService: asValue(checkDefaultFilesService),
  checkOrderDeliveryNoticeService: asValue(checkOrderDeliveryNoticeService),
  checkOrderReceptionService: asValue(checkOrderReceptionService),
  checkShipmentNoticeService: asValue(checkShipmentNoticeService),
  configService: asValue(configService),
  cronConfigService: asValue(cronConfigService),
  customerService: asValue(customerService),
  documentFileService: asValue(documentFileService),
  documentEventService: asValue(documentEventService),
  emailService: asValue(emailService),
  encryptionService: asValue(encryptionService),
  fileService: asValue(fileService),
  folderService: asValue(folderService),
  itemService: asValue(itemService),
  messageService: asValue(messageService),
  monitoringService: asValue(monitoringService),
  orderDetailService: asValue(orderDetailService),
  orderItemService: asValue(orderItemService),
  userAvatarService: asValue(userAvatarService),
  userService: asValue(userService),
  vendedorService: asValue(vendedorService)
});

module.exports = { container };
