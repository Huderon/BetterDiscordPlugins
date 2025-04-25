/**
 * @name MentionFilter
 * @author Huderon
 * @description Provides a filter for suppressing mentions.
 * @version 1.0.3
 * @source https://github.com/Huderon/BetterDiscordPlugins/blob/main/MentionFilter/MentionFilter.plugin.js
 * @invite NUH7cYDZ5A
 */

"use strict";

// src/plugins/MentionFilter/config.json
var config = {
	changelog: [
		{
			title: "Bugs Squashed",
			type: "fixed",
			items: ["Fixed versioning"],
		},
	],
	settings: [
		{
			type: "switch",
			id: "disableMention",
			name: "Disable Mention",
			note: "Automatically disables the mention when replying to someone.",
			value: true,
		},
		{
			type: "switch",
			id: "allowManualPing",
			name: "Allow Manual Pings",
			note: "Allow manual pings even if they are in replies.",
			value: false,
		},
		{
			type: "dropdown",
			id: "mentionSetting",
			name: "Mention Setting",
			value: 1,
			options: [
				{
					label: "Default",
					value: 0,
				},
				{
					label: "Suppress Mentions",
					value: 1,
				},
				{
					label: "Force Mentions",
					value: 2,
				},
			],
		},
		{
			type: "dropdown",
			id: "filterSetting",
			name: "Filter Setting",
			value: 0,
			options: [
				{
					label: "Default",
					value: 0,
				},
				{
					label: "Whitelist",
					value: 1,
				},
				{
					label: "Blacklist",
					value: 2,
				},
			],
		},
	],
};

// src/shared/SettingsManager.js
var SettingsManager = class {
	constructor(pluginName, config2) {
		this.pluginName = pluginName;
		this.settingsPanel = config2.settings;
		this.defaultSettings = Object.fromEntries(
			this.settingsPanel.flatMap((setting) =>
				setting.type === "category" ?
					setting.settings.map((setting2) => [setting2.id, setting2.value])
				:	[[setting.id, setting.value]],
			),
		);
		this.settings = {...this.defaultSettings, ...BdApi.Data.load(this.pluginName, "settings")};
		this.syncSettingsPanel();
	}
	syncSettingsPanel() {
		for (const key in this.settings) {
			this.updateSettingsPanel(key, this.settings[key]);
		}
	}
	updateSettingsPanel(id, value) {
		const setting = this.settingsPanel
			.flatMap((s) => (s.type === "category" ? s.settings : s))
			.find((m) => m.id === id);
		if (setting) setting.value = value;
	}
	get(key) {
		return this.settings[key];
	}
	set(key, value) {
		this.settings[key] = value;
		BdApi.Data.save(this.pluginName, "settings", this.settings);
		this.updateSettingsPanel(key, value);
	}
};

// src/plugins/MentionFilter/components/SuppressedMentionComponent.jsx
var Tooltip = BdApi.Components?.Tooltip;
function SuppressedMentionComponent() {
	return /* @__PURE__ */ BdApi.React.createElement(
		Tooltip,
		{text: "Mention Suppressed"},
		({onMouseEnter, onMouseLeave}) =>
			/* @__PURE__ */ BdApi.React.createElement(
				"span",
				{className: "suppressedMention", onMouseEnter, onMouseLeave},
				"@",
			),
	);
}

// src/plugins/MentionFilter/index.jsx
var Dispatcher = BdApi.Webpack.getByKeys("actionLogger");
var UserStore = BdApi.Webpack.getStore("UserStore");
var [replyActions, replyActionsKey] = BdApi.Webpack.getWithKey(
	(m) =>
		typeof m === "function" &&
		m.toString().includes("shouldMention") &&
		m.toString().includes("CREATE_PENDING_REPLY"),
);
var [RepliedMessageComponent, RepliedMessageComponentKey] = BdApi.Webpack.getWithKey(
	BdApi.Webpack.Filters.byStrings(".repliedMessage", ".repliedMessageClickableSpine"),
);
function removeInterceptor(name) {
	const interceptors = Dispatcher._interceptors;
	const index = interceptors.findIndex((func) => func.name === name || func.name === `bound ${name}`);
	if (index > -1) {
		interceptors.splice(index, 1);
	}
	return interceptors;
}
module.exports = class MentionFilter {
	constructor(meta) {
		this.meta = meta;
		this.settings = new SettingsManager(this.meta.name, config);
		this.suppressed = [];
		this.whitelist = {
			guild: [],
			channel: [],
			user: [],
		};
		this.blacklist = {
			guild: [],
			channel: [],
			user: [],
		};
	}
	// Sorry to whoever has to read this. If you can think of a way to make it more easily parseable, let me know
	messageInterceptor = (e) => {
		if (!["MESSAGE_CREATE", "MESSAGE_UPDATE", "LOAD_MESSAGES_SUCCESS"].includes(e.type)) return;
		const messages = e.type === "LOAD_MESSAGES_SUCCESS" ? e.messages : [e.message];
		const currentUser = UserStore.getCurrentUser();
		const mentionSetting = this.settings.get("mentionSetting");
		const filterSetting = this.settings.get("filterSetting");
		const allowManualPing = this.settings.get("allowManualPing");
		for (let message of messages) {
			if (
				!message.mentions.some((mention) => mention.id === currentUser.id) &&
				message?.referenced_message?.author.id !== currentUser.id
			)
				continue;
			if (allowManualPing && message.content.includes(`<@${currentUser.id}>`)) continue;
			const isWhitelisted = this.isWhitelisted({
				userId: message.author.id,
				channelId: message.channel_id,
				guildId: message.guild_id,
			});
			const isBlacklisted = this.isBlacklisted({
				userId: message.author.id,
				channelId: message.channel_id,
				guildId: message.guild_id,
			});
			const mentionIndex = message.mentions.findIndex((mention) => mention.id === currentUser.id);
			switch (mentionSetting) {
				case 1:
					if ((filterSetting === 1 && isWhitelisted) || (filterSetting === 2 && !isBlacklisted)) break;
					message.mentioned = false;
					if (mentionIndex >= 0) {
						message.mentions.splice(mentionIndex, 1);
						const suppressedIndex = this.suppressed.findIndex((s) => s.messageId === message.id);
						if (suppressedIndex < 0) {
							this.suppressed.push({
								messageId: message.id,
								userId: message.author.id,
							});
						}
					}
					break;
				case 2:
					if ((filterSetting === 1 && !isWhitelisted) || (filterSetting === 2 && isBlacklisted)) break;
					if (mentionIndex < 0) {
						message.mentions.push(currentUser);
					}
					break;
				default:
					break;
			}
		}
	};
	addToFilter(filter, type, id) {
		if (this[filter][type].includes(id)) return;
		this[filter][type].push(id);
		BdApi.Data.save(this.meta.name, filter, this[filter]);
		if (type === "user") {
			this.suppressed = this.suppressed.filter((s) => !(s.userId === id));
		}
	}
	removeFromFilter(filter, type, id) {
		if (!this[filter][type].includes(id)) return;
		this[filter][type] = this[filter][type].filter((item) => item !== id);
		BdApi.Data.save(this.meta.name, filter, this[filter]);
		if (type === "user") {
			this.suppressed = this.suppressed.filter((s) => !(s.userId === id));
		}
	}
	isWhitelisted({userId = null, channelId = null, guildId = null} = {}) {
		return (
			(userId && this.whitelist.user.includes(userId)) ||
			(channelId && this.whitelist.channel.includes(channelId)) ||
			(guildId && this.whitelist.guild.includes(guildId))
		);
	}
	isBlacklisted({userId = null, channelId = null, guildId = null} = {}) {
		return (
			(userId && this.blacklist.user.includes(userId)) ||
			(channelId && this.blacklist.channel.includes(channelId)) ||
			(guildId && this.blacklist.guild.includes(guildId))
		);
	}
	userContextPatch = (returnValue, {user: {id}}) => {
		const buttonNode = BdApi.Utils.findInTree(
			returnValue,
			(node) => Array.isArray(node) && node.some((button) => button?.props?.id === "block"),
		);
		if (!buttonNode) return;
		buttonNode.push(this.contextMenuItem("user", id));
	};
	channelContextPatch = (returnValue, {channel: {id}}) => {
		const buttonNode = BdApi.Utils.findInTree(
			returnValue,
			(node) => Array.isArray(node) && node.some((button) => button?.props?.id === "channel-notifications"),
		);
		if (!buttonNode) return;
		buttonNode.push(this.contextMenuItem("channel", id));
	};
	guildContextPatch = (returnValue, {guild: {id}}) => {
		const buttonNode = BdApi.Utils.findInTree(
			returnValue,
			(node) => Array.isArray(node) && node.some((button) => button?.props?.id === "guild-notifications"),
		);
		if (!buttonNode) return;
		buttonNode.push(this.contextMenuItem("guild", id));
	};
	contextMenuItem = (type, id) => {
		const isWhitelisted = this.isWhitelisted({[`${type}Id`]: id});
		const isBlacklisted = this.isBlacklisted({[`${type}Id`]: id});
		return BdApi.ContextMenu.buildItem({
			type: "submenu",
			label: "Mention Filter",
			children: [
				BdApi.ContextMenu.buildItem({
					type: "toggle",
					label: "Whitelist",
					active: isWhitelisted,
					action: () => {
						this[isWhitelisted ? "removeFromFilter" : "addToFilter"]("whitelist", type, id);
					},
				}),
				BdApi.ContextMenu.buildItem({
					type: "toggle",
					label: "Blacklist",
					active: isBlacklisted,
					action: () => {
						this[isBlacklisted ? "removeFromFilter" : "addToFilter"]("blacklist", type, id);
					},
				}),
			],
		});
	};
	start() {
		const currentVersion = BdApi.Data.load(this.meta.name, "version");
		if (currentVersion !== this.meta.version) {
			BdApi.UI.showChangelogModal({
				title: this.meta.name,
				subtitle: this.meta.version,
				changes: config.changelog,
			});
			BdApi.Data.save(this.meta.name, "version", this.meta.version);
		}
		Object.assign(this.whitelist, BdApi.Data.load(this.meta.name, "whitelist"));
		Object.assign(this.blacklist, BdApi.Data.load(this.meta.name, "blacklist"));
		Dispatcher.addInterceptor(this.messageInterceptor);
		BdApi.ContextMenu.patch("user-context", this.userContextPatch);
		BdApi.ContextMenu.patch("channel-context", this.channelContextPatch);
		BdApi.ContextMenu.patch("guild-context", this.guildContextPatch);
		BdApi.Patcher.before(this.meta.name, replyActions, replyActionsKey, (_, [props]) => {
			if (!this.settings.get("disableMention")) return;
			if (
				(this.settings.get("filterSetting") === 1 &&
					this.isWhitelisted({
						userId: props.message.author.id,
						channelId: props.channel.id,
						guildId: props.channel.guild_id,
					})) ||
				(this.settings.get("filterSetting") === 2 &&
					!this.isBlacklisted({
						userId: props.message.author.id,
						channelId: props.channel.id,
						guildId: props.channel.guild_id,
					}))
			)
				return;
			props.shouldMention = false;
		});
		BdApi.Patcher.after(
			this.meta.name,
			RepliedMessageComponent,
			RepliedMessageComponentKey,
			(_, [props], returnValue) => {
				if (this.suppressed.findIndex((s) => s.messageId === props.baseMessage.id) < 0) return;
				if (this.settings.get("mentionSetting") === 2) return;
				returnValue.props.children.splice(
					2,
					0,
					/* @__PURE__ */ BdApi.React.createElement(SuppressedMentionComponent, null),
				);
				const Message = BdApi.Utils.findInTree(returnValue, (prop) => prop?.withMentionPrefix, {
					walkable: null,
				});
				if (!Message) return;
				Message.withMentionPrefix = false;
			},
		);
	}
	stop() {
		removeInterceptor("messageInterceptor");
		BdApi.ContextMenu.unpatch("user-context", this.userContextPatch);
		BdApi.ContextMenu.unpatch("channel-context", this.channelContextPatch);
		BdApi.ContextMenu.unpatch("guild-context", this.guildContextPatch);
		BdApi.Patcher.unpatchAll(this.meta.name);
	}
	getSettingsPanel() {
		return BdApi.UI.buildSettingsPanel({
			settings: this.settings.settingsPanel,
			onChange: (category, id, value) => {
				this.settings.set(id, value);
			},
		});
	}
};
