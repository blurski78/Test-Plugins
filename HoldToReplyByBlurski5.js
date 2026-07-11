function registerPlugin(plugin) {
  window.enmity.plugins.registerPlugin(plugin);
}

function createPatcher(name) {
  return window.enmity.patcher.create(name);
}

const { React, StyleSheet, Constants, Linking, Navigation } = window.enmity.modules.common;
const { getByProps, getByStore } = window.enmity.modules;
const { View, Text, TouchableOpacity, FormRow, FormSection, FormSwitch } = window.enmity.modules.common.Components;

// Plugin metadata
const manifest = {
  name: "HoldToReply",
  version: "1.0.0",
  description: "Hold notification banner for 2 seconds to open reply box",
  authors: [
    {
      name: "Blurski",
      id: "1497358039718821981"
    }
  ],
  color: "#5865F2"
};

let currentNotif = null;
let overlayRef = null;
let animFrame = null;
let pressTimer = null;

// Settings
function getSetting(key, defaultValue) {
  return window.enmity.settings.get("HoldToReply", key, defaultValue);
}

function setSetting(key, value) {
  window.enmity.settings.set("HoldToReply", key, value);
}

const plugin = {
  ...manifest,
  
  onStart() {
    console.log("[HoldToReply] Plugin started!");
    
    // Find required modules
    const NotificationModule = getByProps("showNotification", "dismissNotification");
    const ChannelStore = getByStore("ChannelStore");
    const MessageStore = getByStore("MessageStore");
    const ChatInputModule = getByProps("sendMessage", "startEditMessage");
    const NavigationModule = getByProps("navigate");
    
    // Store modules for later use
    this._modules = {
      NotificationModule,
      ChannelStore,
      MessageStore,
      ChatInputModule,
      NavigationModule
    };
    
    // Create patcher
    const patcher = createPatcher("HoldToReply");
    this._patcher = patcher;
    
    // Patch notification show method
    if (NotificationModule && NotificationModule.showNotification) {
      patcher.instead(NotificationModule, "showNotification", function(args, original) {
        const notif = args[0];
        if (!notif || !notif.channelId) return original(...args);
        
        currentNotif = {
          channelId: notif.channelId,
          messageId: notif.messageId,
          guildId: notif.guildId || null
        };
        
        // Inject overlay after notification shows
        setTimeout(() => {
          this.injectOverlay();
        }.bind(this), 100);
        
        return original(...args);
      }.bind(this));
    }
  },
  
  injectOverlay() {
    // Remove existing overlay
    this.removeOverlay();
    
    const overlay = document.createElement("div");
    overlay.id = "hold-to-reply-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 120px;
      z-index: 999999;
      background: transparent;
      touch-action: none;
      pointer-events: auto;
    `;
    
    const progress = document.createElement("div");
    progress.id = "hold-progress";
    progress.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      height: 4px;
      background: ${manifest.color};
      width: 0%;
      transition: none;
      border-radius: 0 2px 2px 0;
    `;
    overlay.appendChild(progress);
    
    let startTime = 0;
    
    overlay.addEventListener("touchstart", function(e) {
      e.preventDefault();
      e.stopPropagation();
      startTime = Date.now();
      progress.style.width = "0%";
      
      const animate = function() {
        const elapsed = Date.now() - startTime;
        const pct = Math.min((elapsed / 2000) * 100, 100);
        progress.style.width = pct + "%";
        
        if (pct < 100) {
          animFrame = requestAnimationFrame(animate);
        } else {
          console.log("[HoldToReply] 2 seconds held - opening reply!");
          this.openReplyBox();
          this.removeOverlay();
        }
      }.bind(this);
      
      animFrame = requestAnimationFrame(animate);
    }.bind(this));
    
    overlay.addEventListener("touchend", function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (animFrame) cancelAnimationFrame(animFrame);
      progress.style.width = "0%";
    });
    
    overlay.addEventListener("touchcancel", function(e) {
      if (animFrame) cancelAnimationFrame(animFrame);
      progress.style.width = "0%";
    });
    
    document.body.appendChild(overlay);
    overlayRef = overlay;
  },
  
  openReplyBox() {
    if (!currentNotif) return;
    
    const { ChannelStore, NavigationModule } = this._modules;
    const channel = ChannelStore?.getChannel(currentNotif.channelId);
    if (!channel) return;
    
    // Navigate to channel
    if (NavigationModule?.navigate) {
      NavigationModule.navigate(`/channels/${currentNotif.guildId || "@me"}/${currentNotif.channelId}`);
    }
    
    // Focus input after navigation
    setTimeout(function() {
      const input = document.querySelector(
        '[class*="chatInput"] textarea, [class*="textArea"]'
      );
      if (input) {
        input.focus();
        console.log("[HoldToReply] Input focused!");
      }
    }, 500);
  },
  
  removeOverlay() {
    if (overlayRef && overlayRef.parentNode) {
      overlayRef.parentNode.removeChild(overlayRef);
      overlayRef = null;
    }
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  },
  
  onStop() {
    console.log("[HoldToReply] Plugin stopped!");
    this.removeOverlay();
    if (this._patcher) {
      this._patcher.unpatchAll();
      this._patcher = null;
    }
    currentNotif = null;
  },
  
  getSettingsPanel({ settings }) {
    // Settings panel component
    const styles = StyleSheet.createThemedStyleSheet({
      container: {
        padding: 16
      },
      title: {
        fontSize: 20,
        fontWeight: "bold",
        color: Constants.ThemeColorMap.HEADER_PRIMARY,
        marginBottom: 8
      },
      description: {
        fontSize: 14,
        color: Constants.ThemeColorMap.HEADER_SECONDARY,
        marginBottom: 20
      },
      footer: {
        color: Constants.ThemeColorMap.HEADER_SECONDARY,
        textAlign: "center",
        paddingTop: 20,
        fontSize: 12
      }
    });
    
    return React.createElement(
      View,
      { style: styles.container },
      React.createElement(Text, { style: styles.title }, "HoldToReply"),
      React.createElement(Text, { style: styles.description }, "Hold notification banner for 2 seconds to open reply box"),
      
      React.createElement(
        FormSection,
        { title: "SETTINGS" },
        React.createElement(FormRow, {
          label: "Enable Plugin",
          subLabel: "Toggle the plugin on/off",
          trailing: React.createElement(FormSwitch, {
            value: settings.getBoolean("enabled", true),
            onValueChange: (value) => {
              settings.set("enabled", value);
              if (!value) {
                this.onStop();
              } else {
                this.onStart();
              }
            }
          })
        })
      ),
      
      React.createElement(Text, { style: styles.footer }, `v${manifest.version} by ${manifest.authors[0].name}`)
    );
  }
};

// Register the plugin
registerPlugin(plugin);
