/**
 * ENMITY NOTIFICATION REPLIER PLUGIN
 * Complete single-file plugin for Discord notification replies
 * 
 * Installation:
 * 1. Copy this entire file to your Enmity plugins folder
 * 2. Restart Enmity or reload plugins
 * 3. Enable in Settings → Plugins
 * 
 * Usage:
 * - Hold a notification for 2 seconds to open reply box
 * - Type your message and tap Send
 * - Notifications auto-dismiss after 8 seconds
 */

import { Plugin, registerPlugin } from "enmity/managers/plugins";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from "enmity/components";
import { create } from "enmity/api/settings";
import { getByProps } from "enmity/metro";
import React from "react";

// PLUGIN MANIFEST (Embedded)
const manifest = {
  name: "Notification Replier",
  version: "1.0.0",
  description: "Reply to Discord notifications directly from Enmity with a quick reply interface and timer",
  authors: [
    {
      name: "Blurski",
      id: "1497358039718821981"
    }
  ],
  spec: 2,
  permissions: [
    "VIEW_CHANNELS",
    "SEND_MESSAGES"
  ]
};

// CONFIGURATION
const DISMISS_TIME = 8000; // 8 seconds before auto-dismiss
const HOLD_TIME = 2000;    // 2 seconds hold to open reply
const TIMER_UPDATE_INTERVAL = 100; // Update timer every 100ms

// GLOBAL STATE
let activeNotification = null;
let holdTimer = null;
let isHolding = false;
let notificationTimers = {};

/**
 * Main Plugin Definition
 */
const NotificationReplier: Plugin = {
  name: manifest.name,
  version: manifest.version,
  description: manifest.description,
  authors: manifest.authors,
  color: "#7289DA",

  onLoad() {
    console.log("[NotificationReplier] Plugin loaded successfully");
    setupNotificationInterceptor();
  },

  onUnload() {
    console.log("[NotificationReplier] Plugin unloaded");
    // Cleanup any remaining timers
    Object.values(notificationTimers).forEach(timer => {
      if (timer) clearInterval(timer);
    });
    notificationTimers = {};
  },
};

/**
 * Setup notification interception
 */
function setupNotificationInterceptor() {
  try {
    const NotificationModule = getByProps("showNotification");
    
    if (!NotificationModule) {
      console.error("[NotificationReplier] Could not find notification module");
      return;
    }

    const originalShowNotification = NotificationModule.showNotification;

    NotificationModule.showNotification = function(notification) {
      console.log("[NotificationReplier] Notification intercepted:", notification);
      createEnhancedNotification(notification);
      return originalShowNotification.call(this, notification);
    };

    console.log("[NotificationReplier] Notification interceptor set up successfully");
  } catch (error) {
    console.error("[NotificationReplier] Failed to set up interceptor:", error);
  }
}

/**
 * Create enhanced notification overlay component
 */
function createEnhancedNotification(notification) {
  const notificationId = Math.random().toString(36);

  const NotificationOverlay = () => {
    const [timeLeft, setTimeLeft] = React.useState(DISMISS_TIME / 1000);
    const [showReplyBox, setShowReplyBox] = React.useState(false);
    const [replyText, setReplyText] = React.useState("");
    const [isRemoving, setIsRemoving] = React.useState(false);

    // Timer countdown effect
    React.useEffect(() => {
      const timerInterval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0) {
            clearInterval(timerInterval);
            removeNotification();
            return 0;
          }
          return prev - (TIMER_UPDATE_INTERVAL / 1000);
        });
      }, TIMER_UPDATE_INTERVAL);

      notificationTimers[notificationId] = timerInterval;

      return () => {
        clearInterval(timerInterval);
        delete notificationTimers[notificationId];
      };
    }, []);

    /**
     * Handle press down - start hold timer
     */
    const handleNotificationPressIn = () => {
      isHolding = true;
      holdTimer = setTimeout(() => {
        if (isHolding) {
          console.log("[NotificationReplier] Hold threshold reached, opening reply box");
          setShowReplyBox(true);
        }
      }, HOLD_TIME);
    };

    /**
     * Handle press release - cancel hold timer
     */
    const handleNotificationPressOut = () => {
      isHolding = false;
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    /**
     * Remove notification with fade animation
     */
    const removeNotification = () => {
      setIsRemoving(true);
      setTimeout(() => {
        if (notificationTimers[notificationId]) {
          clearInterval(notificationTimers[notificationId]);
          delete notificationTimers[notificationId];
        }
        activeNotification = null;
      }, 300);
    };

    /**
     * Send reply message
     */
    const sendReply = () => {
      if (!replyText.trim()) {
        Alert.alert("Empty Message", "Please type a message before sending");
        return;
      }

      try {
        const MessageModule = getByProps("sendMessage");
        const SelectedChannelStore = getByProps("getChannelId");
        
        if (!MessageModule || !SelectedChannelStore) {
          throw new Error("Could not find message or channel module");
        }

        const channelId = SelectedChannelStore.getChannelId?.();
        
        if (!channelId) {
          throw new Error("No channel selected");
        }

        // Send the message
        MessageModule.sendMessage(channelId, {
          content: replyText,
        });

        console.log("[NotificationReplier] Message sent successfully");
        Alert.alert("Reply Sent", `Sent: "${replyText}"`);
        setReplyText("");
        setShowReplyBox(false);
        removeNotification();
      } catch (error) {
        console.error("[NotificationReplier] Failed to send reply:", error);
        Alert.alert("Error Sending Reply", error.message || "Failed to send message. Make sure you're in a valid channel.");
      }
    };

    if (isRemoving) return null;

    // Render notification view
    return (
      <View
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          right: 10,
          backgroundColor: "#2C2F33",
          borderRadius: 12,
          padding: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 5,
          zIndex: 9999,
        }}
      >
        {!showReplyBox ? (
          // Notification view with timer
          <TouchableOpacity
            onPressIn={handleNotificationPressIn}
            onPressOut={handleNotificationPressOut}
            style={{ flex: 1 }}
          >
            <View style={{ marginBottom: 8 }}>
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "600",
                  fontSize: 14,
                  marginBottom: 4,
                }}
              >
                {notification.title || "Discord"}
              </Text>
              <Text
                style={{
                  color: "#B9BBBE",
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                {notification.body || "You have a new message"}
              </Text>
            </View>

            {/* Timer bar */}
            <View
              style={{
                height: 3,
                backgroundColor: "#36393F",
                borderRadius: 2,
                marginBottom: 8,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 3,
                  backgroundColor: "#7289DA",
                  borderRadius: 2,
                  width: `${(timeLeft / (DISMISS_TIME / 1000)) * 100}%`,
                }}
              />
            </View>

            <Text
              style={{
                color: "#72767D",
                fontSize: 10,
                textAlign: "center",
              }}
            >
              Hold for 2s to reply • Disappears in {Math.ceil(timeLeft)}s
            </Text>
          </TouchableOpacity>
        ) : (
          // Reply box view
          <View>
            <Text
              style={{
                color: "#FFFFFF",
                fontWeight: "600",
                fontSize: 14,
                marginBottom: 12,
              }}
            >
              Reply to {notification.title || "Discord"}
            </Text>

            <TextInput
              placeholder="Type your reply..."
              placeholderTextColor="#72767D"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={2000}
              style={{
                backgroundColor: "#36393F",
                color: "#FFFFFF",
                borderRadius: 8,
                padding: 10,
                marginBottom: 12,
                maxHeight: 100,
                fontSize: 13,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  setShowReplyBox(false);
                  setReplyText("");
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 6,
                  backgroundColor: "#2C2F33",
                  borderWidth: 1,
                  borderColor: "#72767D",
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontWeight: "500",
                    fontSize: 12,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={sendReply}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 6,
                  backgroundColor: "#7289DA",
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontWeight: "500",
                    fontSize: 12,
                  }}
                >
                  Send
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  activeNotification = <NotificationOverlay />;
}

/**
 * Register the plugin
 */
registerPlugin(NotificationReplier);
