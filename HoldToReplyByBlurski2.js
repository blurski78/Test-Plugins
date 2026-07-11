// Enmity IPA Plugin - HoldToReply
// Author: Blurski
// ID: 1497358039718821981

const { findModule, findStore } = require("@enmity/metro");
const { inject, uninject } = require("@enmity/patcher");

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

class HoldToReply {
  constructor() {
    this.patch = null;
    this.name = manifest.name;
    this.version = manifest.version;
    this.description = manifest.description;
    this.author = manifest.authors[0].name;
  }

  start() {
    console.log("[HoldToReply] Plugin started!");
    
    // Make sure modules are found
    if (!NotificationModule) {
      console.error("[HoldToReply] NotificationModule not found!");
      return;
    }

    // Patch notification show method
    this.patch = inject(
      NotificationModule,
      "showNotification",
      function(args) {
        const notif = args[0];
        if (!notif || !notif.channelId) return args;

        console.log("[HoldToReply] Notification detected:", notif.channelId);

        currentNotif = {
          channelId: notif.channelId,
          messageId: notif.messageId,
          guildId: notif.guildId || null
        };

        this.injectOverlay(notif);
        return args;
      }.bind(this)
    );
  }

  injectOverlay(notif) {
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
      background: #5865F2;
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
      console.log("[HoldToReply] Touch released - cancelling");
    });

    overlay.addEventListener("touchcancel", function(e) {
      if (animFrame) cancelAnimationFrame(animFrame);
      progress.style.width = "0%";
      console.log("[HoldToReply] Touch cancelled");
    });

    document.body.appendChild(overlay);
    overlayRef = overlay;
    console.log("[HoldToReply] Overlay injected");
  }

  openReplyBox() {
    if (!currentNotif) {
      console.error("[HoldToReply] No notification data");
      return;
    }

    const channel = ChannelStore.getChannel(currentNotif.channelId);
    if (!channel) {
      console.error("[HoldToReply] Channel not found");
      return;
    }

    console.log("[HoldToReply] Opening channel:", currentNotif.channelId);

    const navigate = findModule((m) => m?.navigate);
    if (navigate) {
      navigate.navigate(`/channels/${currentNotif.guildId || "@me"}/${currentNotif.channelId}`);
    }

    setTimeout(function() {
      const input = document.querySelector(
        '[class*="chatInput"] textarea, [class*="textArea"]'
      );
      
      if (input) {
        input.focus();
        console.log("[HoldToReply] Input focused");
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
    console.log("[HoldToReply] Plugin stopped!");
    if (this.patch) uninject(this.patch);
    this.removeOverlay();
    if (pressTimer) clearTimeout(pressTimer);
    if (animFrame) cancelAnimationFrame(animFrame);
  }
}

// IPA export format
module.exports = HoldToReply;
module.exports.manifest = manifest;

// Also try this for IPA
if (typeof window !== 'undefined') {
  if (!window.__enmity_plugins) window.__enmity_plugins = {};
  window.__enmity_plugins["HoldToReply"] = {
    default: HoldToReply,
    manifest: manifest
  };
}

console.log("[HoldToReply] Plugin loaded successfully!");
