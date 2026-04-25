/**
 * LABEOUF_SECURITY_PROTOCOL: Notification Handler
 * Manages the handshake between the browser and the OS for tactical alerts.
 */

export const requestNotificationPermission = async () => {
  // Check if the browser even supports notifications
  if (!("Notification" in window)) {
    console.warn("CRITICAL_SYSTEM_LOG: NOTIFICATION_SYSTEM_UNSUPPORTED");
    return;
  }

  // Request permission if not already granted or denied
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === "granted") {
        new Notification("SYSTEM_UPLINK_ESTABLISHED", {
          body: "Tactical alerts are now active for the LaBeouf stream.",
          icon: "/favicon.ico",
          silent: false
        });
      }
    } catch (error) {
      console.error("NOTIFICATION_HANDSHAKE_FAILURE:", error);
    }
  }
};

/**
 * Dispatches a tactical alert to the OS.
 * @param {string} title - The alert header.
 * @param {string} message - The alert payload.
 */
export const sendTacticalAlert = (title, message) => {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body: message,
      icon: "/favicon.ico",
      tag: "threat-alert", // Overwrites previous alerts to prevent notification spam
      requireInteraction: true // Keeps the alert visible until dismissed on desktop
    });
  }
};