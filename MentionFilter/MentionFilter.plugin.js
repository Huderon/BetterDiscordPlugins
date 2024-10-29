/**
 * @name MentionFilter
 * @author Huderon
 * @description Provides a filter for suppressing mentions.
 * @version 1.0.0
 */

const {Data, Webpack, Patcher, React, Utils, ContextMenu} = BdApi;
const Dispatcher = Webpack.getByKeys("actionLogger");
const {Tooltip, FormSwitch, FormItem, FormDivider, FormContextProvider, SingleSelect} =
    Webpack.getByKeys("Tooltip", "FormSwitch");
const UserStore = Webpack.getStore("UserStore");
const FormClasses = Webpack.getByKeys("dividerDefault");
const [replyActions, replyActionsKey] = Webpack.getWithKey(
    (m) => typeof m === "function" && m.toString().includes("shouldMention") && m.toString().includes("showMentionToggle")
);
const [RepliedMessageComponent, RepliedMessageComponentKey] = Webpack.getWithKey(
    (m) => typeof m === "function" && m.toString().includes(".repliedTextContentLeadingIcon")
);

function removeInterceptor(name) {
    const interceptors = Dispatcher._interceptors;
    const index = interceptors.findIndex((func) => func.name === name || func.name === `bound ${name}`);
    if (index > -1) {
        interceptors.splice(index, 1);
    }
    return interceptors;
}

function SuppressedMentionComponent() {
    return React.createElement(Tooltip, {text: "Mention Suppressed"}, ({onMouseEnter, onMouseLeave}) =>
        React.createElement(
            "span",
            {
                className: `suppressedMention`,
                onMouseEnter,
                onMouseLeave,
            },
            "@"
        )
    );
}

function FormSwitchWrapper(props) {
    const [checked, setChecked] = React.useState(props.value);

    return React.createElement(FormSwitch, {
        children: props.label,
        note: props.description,
        value: checked,
        onChange: (e) => {
            props.onChange(e);
            setChecked(e);
        },
    });
}

function SingleSelectWrapper(props) {
    const [selectedValue, setSelectedValue] = React.useState(props.value);

    return React.createElement(
        "div",
        {className: FormClasses.container},
        React.createElement(
            FormItem,
            {title: props.title},
            React.createElement(
                FormContextProvider,
                null,
                React.createElement(SingleSelect, {
                    value: selectedValue,
                    onChange: (e) => {
                        props.onChange(e);
                        setSelectedValue(e);
                    },
                    options: props.options,
                }),
                React.createElement(FormDivider, {className: FormClasses.dividerDefault})
            )
        )
    );
}

module.exports = class MentionFilter {
    constructor(meta) {
        this.meta = meta;
        this.settings = {
            disableMention: true,
            mentionSetting: 1,
            filterSetting: 0,
            allowManualPing: false,
        };
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

    messageInterceptor = (e) => {
        if (!["MESSAGE_CREATE", "MESSAGE_UPDATE", "LOAD_MESSAGES_SUCCESS"].includes(e.type)) return;

        const messages = e.type === "LOAD_MESSAGES_SUCCESS" ? e.messages : [e.message];
        const currentUser = UserStore.getCurrentUser();

        for (let message of messages) {
            if (!message.mentions.some(mention => mention.id === currentUser.id)) continue;
            if ((this.settings.allowManualPing && message.content.includes(`<@${currentUser.id}>`))) continue;
            if (
                (this.settings.filterSetting === 1 &&
                    this.isWhitelisted({
                        userId: message.author.id,
                        channelId: message.channel_id,
                        guildId: message.guild_id
                    })) ||
                (this.settings.filterSetting === 2 &&
                    !this.isBlacklisted({
                        userId: message.author.id,
                        channelId: message.channel_id,
                        guildId: message.guild_id
                    }))
            ) continue;

            const mentionIndex = message.mentions.findIndex((mention) => mention.id === currentUser.id);

            switch (this.settings.mentionSetting) {
                case 1:
                    message.mentioned = false;
                    if (mentionIndex >= 0) {
                        message.mentions.splice(mentionIndex, 1);
                        const suppressedIndex = this.suppressed.findIndex(s =>
                            s.messageId === message.id);
                        if (suppressedIndex < 0) {
                            this.suppressed.push({messageId: message.id, userId: message.author.id});
                        }
                    }
                    break;
                case 2:
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
        Data.save(this.meta.name, filter, this[filter]);
        if (type === "user") {
            this.suppressed = this.suppressed.filter(s => !(s.userId === id));
        }
    }

    removeFromFilter(filter, type, id) {
        if (!this[filter][type].includes(id)) return;
        this[filter][type] = this[filter][type].filter((item) => item !== id);
        Data.save(this.meta.name, filter, this[filter]);
        if (type === "user") {
            this.suppressed = this.suppressed.filter(s => !(s.userId === id));
        }
    }

    isWhitelisted({userId = null, channelId = null, guildId = null} = {}) {
        return (userId && this.whitelist.user.includes(userId)) || (channelId && this.whitelist.channel.includes(channelId)) || (guildId && this.whitelist.guild.includes(guildId));
    }

    isBlacklisted({userId = null, channelId = null, guildId = null} = {}) {
        return (userId && this.blacklist.user.includes(userId)) || (channelId && this.blacklist.channel.includes(channelId)) || (guildId && this.blacklist.guild.includes(guildId));
    }

    userContextPatch = (returnValue, {user: {id}}) => {
        const buttonNode = Utils.findInTree(returnValue, node => Array.isArray(node) && node.some(button => button?.props?.id === "block"));
        if (!buttonNode) return;
        buttonNode.push(this.contextMenuItem("user", id));
    };

    channelContextPatch = (returnValue, {channel: {id}}) => {
        const buttonNode = Utils.findInTree(returnValue, node => Array.isArray(node) && node.some(button => button?.props?.id === "channel-notifications"));
        if (!buttonNode) return;
        buttonNode.push(this.contextMenuItem("channel", id));
    };

    guildContextPatch = (returnValue, {guild: {id}}) => {
        const buttonNode = Utils.findInTree(returnValue, node => Array.isArray(node) && node.some(button => button?.props?.id === "guild-notifications"));
        if (!buttonNode) return;
        buttonNode.push(this.contextMenuItem("guild", id));
    };

    contextMenuItem = (type, id) => {
        const isWhitelisted = this.isWhitelisted({[`${type}Id`]: id});
        const isBlacklisted = this.isBlacklisted({[`${type}Id`]: id});
        return ContextMenu.buildItem({
            type: "submenu",
            label: "Mention Filter",
            children: [
                ContextMenu.buildItem({
                    type: "toggle",
                    label: "Whitelist",
                    active: isWhitelisted,
                    action: () => {
                        this[isWhitelisted ? "removeFromFilter" : "addToFilter"]("whitelist", type, id);
                    },
                }),
                ContextMenu.buildItem({
                    type: "toggle",
                    label: "Blacklist",
                    active: isBlacklisted,
                    action: () => {
                        this[isBlacklisted ? "removeFromFilter" : "addToFilter"]("blacklist", type, id);
                    },
                }),
            ],
        })
    }

    GeneralSettingsPanel = () => {
        return React.createElement(
            React.Fragment,
            null,
            React.createElement(FormSwitchWrapper, {
                label: "Disable Mention",
                description: "Automatically disables the 'Mention' option when replying to someone else.",
                value: this.settings.disableMention,
                onChange: (e) => {
                    this.settings.disableMention = e;
                    Data.save(this.meta.name, "settings", this.settings);
                },
            }),
            React.createElement(FormSwitchWrapper, {
                label: "Allow Manual Pings",
                description: "Allow manual pings to mention even if they are in replies.",
                value: this.settings.allowManualPing,
                onChange: (e) => {
                    this.settings.allowManualPing = e;
                    Data.save(this.meta.name, "settings", this.settings);
                },
            }),
            React.createElement(SingleSelectWrapper, {
                title: "Mention Settings",
                value: this.settings.mentionSetting,
                options: [
                    {label: "Default", value: 0},
                    {label: "Suppress Mentions", value: 1},
                    {label: "Force Mentions", value: 2},
                ],
                onChange: (e) => {
                    this.settings.mentionSetting = e;
                    Data.save(this.meta.name, "settings", this.settings);
                },
            }),
            React.createElement(SingleSelectWrapper, {
                title: "Filter Settings",
                value: this.settings.filterSetting,
                options: [
                    {label: "Default", value: 0},
                    {label: "Whitelist", value: 1},
                    {label: "Blacklist", value: 2},
                ],
                onChange: (e) => {
                    this.settings.filterSetting = e;
                    Data.save(this.meta.name, "settings", this.settings);
                },
            }),
        );
    };

    start() {
        Object.assign(this.settings, Data.load(this.meta.name, "settings"));
        Object.assign(this.whitelist, Data.load(this.meta.name, "whitelist"));
        Object.assign(this.blacklist, Data.load(this.meta.name, "blacklist"));
        Dispatcher.addInterceptor(this.messageInterceptor);
        ContextMenu.patch("user-context", this.userContextPatch);
        ContextMenu.patch("channel-context", this.channelContextPatch);
        ContextMenu.patch("guild-context", this.guildContextPatch);
        Patcher.before(this.meta.name, replyActions, replyActionsKey, (_, [{reply}]) => {
            if (!this.settings.disableMention) return;
            if ((this.settings.filterSetting === 1 &&
                    this.isWhitelisted({
                        userId: reply.message.author.id,
                        channelId: reply.channel.id,
                        guildId: reply.channel.guild_id
                    })) ||
                (this.settings.filterSetting === 2 &&
                    !this.isBlacklisted({
                        userId: reply.message.author.id,
                        channelId: reply.channel.id,
                        guildId: reply.channel.guild_id
                    }))) return;
            reply.shouldMention = false;
        });
        Patcher.after(this.meta.name, RepliedMessageComponent, RepliedMessageComponentKey, (_, [props], returnValue) => {
            if (this.suppressed.findIndex(s => s.messageId === props.baseMessage.id) < 0) return;
            if (this.settings.mentionSetting === 2) return;
            returnValue.props.children.splice(2, 0, React.createElement(SuppressedMentionComponent));
            const Message = Utils.findInTree(returnValue, (prop) => prop?.withMentionPrefix, {walkable: null});
            if (!Message) return;
            Message.withMentionPrefix = false;
        });
    }

    stop() {
        removeInterceptor("messageInterceptor");
        ContextMenu.unpatch("user-context", this.userContextPatch);
        ContextMenu.unpatch("channel-context", this.channelContextPatch);
        ContextMenu.unpatch("guild-context", this.guildContextPatch);
        Patcher.unpatchAll(this.meta.name);
    }

    getSettingsPanel() {
        return React.createElement(this.GeneralSettingsPanel);
    }
};
