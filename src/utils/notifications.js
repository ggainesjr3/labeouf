export const requestNotificationPermission = async () => {
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
