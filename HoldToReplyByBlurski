const { Plugin } = require("@enmity/api");
const { findModule, findStore } = require("@enmity/metro");
const { React, Flux } = require("@enmity/metro/common");
const { getByProps } = require("@enmity/modules");
const { inject, uninject } = require("@enmity/patcher");

// Find required modules
const NotificationModule = findModule(
  (m) => m?.showNotification && m?.dismissNotification
);

const ChannelStore = findStore("ChannelStore");
const MessageStore = findStore("MessageStore");
const ChatInputModule = findModule(
  (m) => m?.sendMessage && m?.startEditMessage
);

let pressTimer = null;
let currentNotif = null;
let overlayRef = null;
let animFrame = null;

// Plugin metadata with YOUR info
const manifest = {
  name: "HoldToReply",
  description: "Hold notification banner for 2 seconds to open reply box",
  color: "#5865F2",
  spec: "1",
  authors: [
    {
      name: "Blurski",
      id: "1497358039718821981"
    }
  ],
  version: "1.0.0"
};

class HoldToReply {
  constructor() {
    this.patch = null;
    this.name = manifest.name;
    this.version = manifest.version;
    this.description = manifest.description;
    this.author = manifest.authors[0].name;
  }

  start() {
    // Patch notification show method
    this.patch = inject(
      NotificationModule,
      "showNotification",
      function(args) {
        const notif = args[0];
        if (!notif || !notif.channelId) return args;

        // Store notification data
        currentNotif = {
          channelId: notif.channelId,
          messageId: notif.messageId,
          guildId: notif.guildId || null
        };

        // Add long-press listener via overlay
        this.injectOverlay(notif);

        return args;
      }.bind(this)
    );
  }

  injectOverlay(notif) {
    // Create invisible overlay that captures touch events
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
    `;

    // Progress bar
    const progress = document.createElement("div");
    progress.id = "hold-progress";
    progress.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: ${manifest.color};
      width: 0%;
      transition: none;
      border-radius: 0 2px 2px 0;
    `;
    overlay.appendChild(progress);

    // Touch events
    let startTime = 0;

    overlay.addEventListener("touchstart", function(e) {
      e.preventDefault();
      startTime = Date.now();
      progress.style.width = "0%";
      
      // Animate progress bar over 2 seconds
      const animate = function() {
        const elapsed = Date.now() - startTime;
        const pct = Math.min((elapsed / 2000) * 100, 100);
        progress.style.width = pct + "%";
        
        if (pct < 100) {
          animFrame = requestAnimationFrame(animate);
        } else {
          // 2 seconds reached — trigger reply
          this.openReplyBox();
          this.removeOverlay();
        }
      }.bind(this);
      
      animFrame = requestAnimationFrame(animate);
    }.bind(this));

    overlay.addEventListener("touchend", function(e) {
      e.preventDefault();
      if (animFrame) cancelAnimationFrame(animFrame);
      progress.style.width = "0%";
    });

    overlay.addEventListener("touchcancel", function(e) {
      if (animFrame) cancelAnimationFrame(animFrame);
      progress.style.width = "0%";
    });

    document.body.appendChild(overlay);
    overlayRef = overlay;
  }

  openReplyBox() {
    if (!currentNotif) return;

    const channel = ChannelStore.getChannel(currentNotif.channelId);
    if (!channel) return;

    // Open the channel
    const navigate = findModule((m) => m?.navigate);
    navigate?.navigate(`/channels/${currentNotif.guildId || "@me"}/${currentNotif.channelId}`);

    // Focus input and set reply context
    setTimeout(function() {
      const input = document.querySelector(
        '[class*="chatInput"] textarea, [class*="textArea"]'
      );
      
      if (input) {
        input.focus();
        // Set reply to the specific message if possible
        const message = MessageStore.getMessage(
          currentNotif.channelId,
          currentNotif.messageId
        );
        if (message && ChatInputModule?.startEditMessage) {
          ChatInputModule.startEditMessage(
            currentNotif.channelId,
            currentNotif.messageId,
            message.content
          );
        }
      }
    }, 300);
  }

  removeOverlay() {
    if (overlayRef && overlayRef.parentNode) {
      overlayRef.parentNode.removeChild(overlayRef);
      overlayRef = null;
    }
    currentNotif = null;
  }

  stop() {
    if (this.patch) uninject(this.patch);
    this.removeOverlay();
    if (pressTimer) clearTimeout(pressTimer);
    if (animFrame) cancelAnimationFrame(animFrame);
  }

  // Getter methods for Enmity
  getName() {
    return this.name;
  }

  getVersion() {
    return this.version;
  }

  getDescription() {
    return this.description;
  }

  getAuthor() {
    return this.author;
  }

  getManifest() {
    return manifest;
  }
}

// ⚠️ EXPORT WITH YOUR CLASS NAME ⚠️
module.exports = HoldToReply;
module.exports.manifest = manifest;
