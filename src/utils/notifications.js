// Enhanced notifications with Capacitor support
import { PushNotifications } from '@capacitor/push-notifications';

export const requestNotificationPermission = async () => {
  // Check if running in Capacitor (native mobile)
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    return await requestCapacitorPermissions();
  } else {
    return await requestWebPermissions();
  }
};

const requestWebPermissions = async () => {
  if (!("Notification" in window)) {
    alert("SYSTEM_ERROR: Notifications not supported.");
    return "unsupported";
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    return "error";
  }
};

const requestCapacitorPermissions = async () => {
  try {
    // Request push notification permissions
    const result = await PushNotifications.requestPermissions();
    if (result.receive === 'granted') {
      // Register for push notifications
      await PushNotifications.register();

      // Set up listeners
      setupCapacitorListeners();

      return "granted";
    } else {
      return "denied";
    }
  } catch (error) {
    console.error('Error requesting Capacitor permissions:', error);
    return "error";
  }
};

const setupCapacitorListeners = () => {
  // On registration success
  PushNotifications.addListener('registration', (token) => {
    console.log('[PUSH] Registration successful, token:', token.value);
    // Here you would typically send the token to your backend
  });

  // On registration error
  PushNotifications.addListener('registrationError', (error) => {
    console.error('[PUSH] Registration failed:', error);
  });

  // On push notification received
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[PUSH] Notification received:', notification);

    // Show local notification if app is in foreground
    if (notification.data && notification.data.showLocal !== 'false') {
      showLocalNotification(notification.title, {
        body: notification.body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: notification.data?.tag || 'labeouf-push',
        data: notification.data,
        actions: notification.data?.actions || []
      });
    }
  });

  // On push notification action performed
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[PUSH] Action performed:', action);

    const data = action.notification.data;
    if (action.actionId === 'view' && data?.url) {
      window.location.href = data.url;
    }
    // Handle other actions as needed
  });
};

export const showLocalNotification = (title, options = {}) => {
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    // Use Capacitor local notifications
    return showCapacitorLocalNotification(title, options);
  } else {
    // Use web notifications
    return showWebNotification(title, options);
  }
};

const showWebNotification = (title, options) => {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [200, 100, 200],
      ...options
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    return notification;
  }
};

const showCapacitorLocalNotification = async (title, options) => {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    await LocalNotifications.schedule({
      notifications: [{
        title,
        body: options.body,
        id: Date.now(),
        schedule: { at: new Date(Date.now() + 1000) }, // Show immediately
        sound: options.silent ? null : 'default',
        attachments: null,
        actionTypeId: '',
        extra: options.data || {}
      }]
    });
  } catch (error) {
    console.error('Error showing Capacitor local notification:', error);
  }
};

export const sendThreatAlert = (threatLevel, message) => {
  const title = `[${threatLevel}] SECURITY ALERT`;
  const options = {
    body: message,
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'threat-alert',
    requireInteraction: threatLevel === 'CRITICAL',
    data: {
      type: 'threat',
      level: threatLevel,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View Feed',
        url: '/'
      }
    ]
  };

  return showLocalNotification(title, options);
};

export const sendOfflineAlert = () => {
  return showLocalNotification('OFFLINE MODE', {
    body: 'Network connection lost. Operating in offline mode.',
    icon: '/logo192.png',
    tag: 'offline-alert',
    data: { type: 'offline' }
  });
};

export const sendOnlineAlert = () => {
  return showLocalNotification('BACK ONLINE', {
    body: 'Network connection restored.',
    icon: '/logo192.png',
    tag: 'online-alert',
    data: { type: 'online' }
  });
};
