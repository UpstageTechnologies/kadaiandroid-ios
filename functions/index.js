const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

const maskToken = token => {
  const value = String(token || '');
  return value.length > 8
    ? `${value.slice(0, 4)}…${value.slice(-4)}`
    : '[unavailable]';
};

const STATUS_TITLES = {
  Accepted: '✅ Order Accepted',
  Packed: '📦 Order Packed',
  Pending: '⏳ Order Delayed',
  'Out For Delivery': '🚚 Out For Delivery',
  Delivered: '🎉 Order Delivered',
  Rejected: '❌ Order Rejected',
};

const STATUS_MESSAGES = {
  Accepted: 'has been accepted',
  Packed: 'has been packed',
  Pending: 'is currently pending/delayed',
  'Out For Delivery': 'is out for delivery',
  Delivered: 'has been delivered',
  Rejected: 'has been rejected',
};

const normalizeMarketType = value =>
  String(value || '').trim().toLowerCase() === 'global' ? 'global' : 'local';

const normalizeOrderStatus = value => {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const aliases = {
    accept: 'Accepted',
    accepted: 'Accepted',
    packed: 'Packed',
    pending: 'Pending',
    hold: 'Pending',
    'on hold': 'Pending',
    'out for delivery': 'Out For Delivery',
    delivered: 'Delivered',
    reject: 'Rejected',
    rejected: 'Rejected',
    cancelled: 'Rejected',
    canceled: 'Rejected',
    'pending verification': 'Pending Verification',
    'order placed': 'Order Placed',
  };

  return aliases[normalized] || raw;
};

async function sendCustomerStatusNotification({
  eventId,
  customerUid,
  orderId,
  status,
  shopName,
}) {
  const title = STATUS_TITLES[status];
  const actionText = STATUS_MESSAGES[status];

  if (!title || !actionText) {
    console.log('[orders] Notification skipped for unsupported status', {
      orderId,
      status,
    });
    return;
  }

  console.log('[orders] Recognized customer status for notification', {
    customerUid,
    orderId,
    status,
  });

  const customerRef = db.collection('customers').doc(customerUid);
  const customerOrderRef = customerRef.collection('orders').doc(orderId);
  const customerSnapshot = await customerRef.get();
  const token = customerSnapshot.data()?.fcmToken;

  if (typeof token !== 'string' || !token.trim()) {
    console.log('[orders] FCM skipped: customer token is missing', {
      customerUid,
      customerPath: `customers/${customerUid}`,
      orderId,
    });
    return;
  }

  console.log('[orders] FCM target confirmed', {
    customerUid,
    customerPath: `customers/${customerUid}`,
    orderId,
    tokenPresent: true,
    token: maskToken(token),
  });

  // Cloud Firestore events can be retried. Claim the event before sending so a
  // retried event does not deliver the same status notification twice.
  const deliveryRef = customerOrderRef
    .collection('_notificationEvents')
    .doc(String(eventId));
  const claimed = await db.runTransaction(async transaction => {
    const deliverySnapshot = await transaction.get(deliveryRef);
    if (deliverySnapshot.exists) return false;

    transaction.create(deliveryRef, {
      status,
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });

  if (!claimed) {
    console.log('[orders] Duplicate event skipped', { orderId, status });
    return;
  }

  let messageId;
  try {
    console.log('[orders] FCM send attempted', { customerUid, orderId, status });
    messageId = await messaging.send({
      token,
      data: {
        orderId: String(orderId),
        status: String(status),
        screen: 'TrackOrderScreen',
        title,
        body: `${shopName ? `${shopName}: ` : ''}Your order ${orderId} ${actionText}.`,
      },
      android: { priority: 'high' },
    });
  } catch (error) {
    // Never log the message payload or registration token.
    console.error('[orders] FCM send failed', {
      customerUid,
      orderId,
      status,
      code: error?.code || 'unknown',
      message: String(error?.message || 'unknown').split(token).join('[redacted-token]'),
    });

    if (
      error?.code === 'messaging/registration-token-not-registered' ||
      error?.code === 'messaging/invalid-registration-token'
    ) {
      await customerRef.set({ fcmToken: null }, { merge: true });
      await deliveryRef.set(
        { state: 'failed', code: error.code },
        { merge: true },
      );
      console.log('[orders] Invalid customer token cleared', { orderId });
      return;
    }

    await deliveryRef.delete();
    throw error;
  }

  console.log('[orders] FCM send succeeded', { orderId, status, messageId });
  try {
    await deliveryRef.set(
      { state: 'sent', sentAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  } catch (error) {
    // The claim remains in place, so a later duplicate event will not resend.
    console.warn('[orders] FCM delivery marker update failed', {
      orderId,
      code: error?.code || 'unknown',
    });
  }
}

function statusChanged(before, after) {
  return String(before?.status || '') !== String(after?.status || '');
}

function changedShopStatuses(beforeData, afterData) {
  const beforeShops = Array.isArray(beforeData?.orderedShops)
    ? beforeData.orderedShops
    : [];
  const afterShops = Array.isArray(afterData?.orderedShops)
    ? afterData.orderedShops
    : [];

  return afterShops.flatMap((shop, index) => {
    const oldShop = beforeShops.find(candidate =>
      String(candidate.shopId || '') === String(shop.shopId || '') &&
      normalizeMarketType(candidate.marketType) === normalizeMarketType(shop.marketType),
    ) || beforeShops[index];

    if (!statusChanged(oldShop, shop)) return [];
    return [{ shop, index }];
  });
}

exports.sendOrderStatusNotification = onDocumentUpdated(
  { document: 'customers/{customerUid}/orders/{orderId}', retry: true, region: 'asia-south1' },
  async event => {
    const change = event.data;
    if (!change) {
      console.log('[orders] Customer order event has no before/after data');
      return;
    }

    const { customerUid, orderId } = event.params;
    const beforeData = change.before.data() || {};
    const afterData = change.after.data() || {};
    const changedShops = changedShopStatuses(beforeData, afterData);

    console.log('[orders] Customer order update received', {
      customerUid,
      orderId,
      changedShopCount: changedShops.length,
      rootStatusChanged: statusChanged(beforeData, afterData),
    });

    if (changedShops.length) {
      await Promise.all(changedShops.map(({ shop, index }) =>
        sendCustomerStatusNotification({
          eventId: `${event.id}_shop_${index}`,
          customerUid,
          orderId,
          status: shop.status,
          shopName: shop.shopName,
        }),
      ));
      return;
    }

    if (!statusChanged(beforeData, afterData)) {
      console.log('[orders] No customer-visible status change', { orderId });
      return;
    }

    await sendCustomerStatusNotification({
      eventId: `${event.id}_root`,
      customerUid,
      orderId,
      status: afterData.status,
    });
  },
);

async function syncSellerOrderStatus(event, marketType) {
  const change = event.data;
  if (!change) {
    console.log('[orders] Seller order event has no before/after data', { marketType });
    return;
  }

  const beforeData = change.before.data() || {};
  const afterData = change.after.data() || {};
  if (!statusChanged(beforeData, afterData)) return;

  const { sellerUid, orderId } = event.params;
  const customerUid = String(afterData.customerUid || beforeData.customerUid || '');
  console.log('[orders] Seller status-change event received', {
    sellerUid,
    customerUid: customerUid || null,
    orderId,
    marketType,
    beforeStatus: beforeData.status || null,
    afterStatus: afterData.status || null,
  });
  if (!customerUid) {
    console.warn('[orders] Seller order is missing customerUid', { orderId, marketType });
    return;
  }

  const customerOrderRef = db
    .collection('customers')
    .doc(customerUid)
    .collection('orders')
    .doc(orderId);
  const customerStatus = normalizeOrderStatus(afterData.status);
  const previousStatus = normalizeOrderStatus(beforeData.status);

  const result = await db.runTransaction(async transaction => {
    const customerOrderSnapshot = await transaction.get(customerOrderRef);
    if (!customerOrderSnapshot.exists) return 'customer-order-missing';

    const customerOrder = customerOrderSnapshot.data() || {};
    const orderedShops = Array.isArray(customerOrder.orderedShops)
      ? [...customerOrder.orderedShops]
      : [];
    const matchingIndexes = orderedShops
      .map((shop, index) => ({ shop, index }))
      .filter(({ shop }) => String(shop.shopId || '') === sellerUid)
      .filter(({ shop }) =>
        !shop.marketType || normalizeMarketType(shop.marketType) === marketType,
      );

    if (matchingIndexes.length !== 1) {
      if (!orderedShops.length && customerOrder.shopId === sellerUid) {
        transaction.update(customerOrderRef, {
          status: customerStatus,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return 'legacy-root-status-synced';
      }
      return 'matching-shop-not-found';
    }

    const { index } = matchingIndexes[0];
    const previousShopStatus = orderedShops[index].status;
    const nextShop = {
      ...orderedShops[index],
      status: customerStatus,
      lastStatus:
        normalizeOrderStatus(afterData.lastStatus) ||
        (customerStatus === 'Pending' ? previousStatus : null),
      pendingMessage: afterData.pendingMessage || null,
      pendingUntil: afterData.pendingUntil || null,
    };
    orderedShops[index] = nextShop;

    transaction.update(customerOrderRef, {
      orderedShops,
      status: customerStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return `synced:${previousShopStatus || 'unknown'}->${customerStatus}`;
  });

  if (result.startsWith('synced:') || result === 'legacy-root-status-synced') {
    console.log('[orders] Customer order document updated', {
      customerUid,
      customerOrderPath: `customers/${customerUid}/orders/${orderId}`,
      orderId,
      marketType,
      status: customerStatus,
    });
  }
  console.log('[orders] Seller status sync completed', {
    customerUid,
    customerOrderPath: `customers/${customerUid}/orders/${orderId}`,
    orderId,
    marketType,
    result,
  });
}

exports.syncLocalSellerOrderStatus = onDocumentUpdated(
  { document: 'users/{sellerUid}/local_orders/{orderId}', retry: true, region: 'asia-south1' },
  event => syncSellerOrderStatus(event, 'local'),
);

exports.syncGlobalSellerOrderStatus = onDocumentUpdated(
  { document: 'users/{sellerUid}/global_orders/{orderId}', retry: true, region: 'asia-south1' },
  event => syncSellerOrderStatus(event, 'global'),
);
