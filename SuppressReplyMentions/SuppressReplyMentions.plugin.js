/**
 * @name SuppressReplyMentions
 * @description Suppresses mentions from Replied messages and when replying to someone else.
 * @author Strencher, Huderon
 * @version 1.0.0
 */

const { Data, Webpack, Patcher, React, Utils } = BdApi;
const Dispatcher = Webpack.getByKeys("actionLogger");
const { Tooltip, FormSwitch, FormItem, SingleSelect } = Webpack.getByKeys("Tooltip", "FormSwitch");
const UserStore = Webpack.getStore("UserStore");
const [replyActions, replyActionsKey] = BdApi.Webpack.getWithKey(
  (m) => typeof m === "function" && m.toString().includes("shouldMention") && m.toString().includes("showMentionToggle")
);
const [RepliedMessageComponent, RepliedMessageComponentKey] = BdApi.Webpack.getWithKey(
  (m) => typeof m === "function" && m.toString().includes(".repliedTextContentLeadingIcon")
);
const currentUser = UserStore.getCurrentUser();

function SuppressedMentionComponent() {
  return React.createElement(Tooltip, { text: "Mention Suppressed" }, ({ onMouseEnter, onMouseLeave }) =>
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

function FormSwitchWrapper(args) {
  const [checked, setChecked] = React.useState(args.value);

  return React.createElement(FormSwitch, {
    children: args.label,
    note: args.description,
    value: checked,
    onChange: (e) => {
      args.onChange(e);
      setChecked(e);
    },
  });
}

function SingleSelectWrapper(args) {
  const [selectedValue, setSelectedValue] = React.useState(args.value);

  return React.createElement(
    FormItem,
    { title: args.title },
    React.createElement(SingleSelect, {
      value: selectedValue,
      onChange: (e) => {
        args.onChange(e);
        setSelectedValue(e);
      },
      options: args.options,
    })
  );
}

module.exports = class SuppressReplyMentions {
  constructor(meta) {
    this.meta = meta;
    this.settings = {
      disableMention: true,
      mentionSetting: 1,
      allowManualPing: false,
    };
    this.suppressed = [];
  }

  removeInterceptor(name) {
    const interceptors = Dispatcher._interceptors;
    const index = interceptors.findIndex((func) => func.name === name || func.name === `bound ${name}`);
    if (index > -1) {
      interceptors.splice(index, 1);
    }
    return interceptors;
  }

  messageInterceptor(e) {
    if (!["MESSAGE_CREATE", "MESSAGE_UPDATE", "LOAD_MESSAGES_SUCCESS"].includes(e.type)) return;

    const messages = e.type === "LOAD_MESSAGES_SUCCESS" ? e.messages : [e.message];

    for (let message of messages) {
      if (
        message.type !== 19 ||
        !message.referenced_message ||
        message.referenced_message.author.id !== currentUser.id ||
        (this.settings.allowManualPing && message.content.includes(`<@${currentUser.id}>`)) ||
        e.type === "LOAD_MESSAGES_SUCCESS" && !this.suppressed.includes(message.id)
      ) continue;

      const mentionIndex = message.mentions.findIndex((mention) => mention.id === currentUser.id);

      switch (this.settings.mentionSetting) {
        case 1:
          if (mentionIndex >= 0) {
            message.mentions.splice(mentionIndex, 1);
            if (!this.suppressed.includes(message.id)) {
              this.suppressed.push(message.id);
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
  }

  start() {
    Object.assign(this.settings, Data.load("SuppressReplyMentions", "settings"));
    Dispatcher.addInterceptor(this.messageInterceptor.bind(this));
    Patcher.before(this.meta.name, replyActions, replyActionsKey, (_, [{ reply }]) => {
      if (!this.settings.disableMention) return;
      reply.shouldMention = false;
    });
    Patcher.after(this.meta.name, RepliedMessageComponent, RepliedMessageComponentKey, (_, [args], returnValue) => {
      if (this.suppressed.indexOf(args.baseMessage.id) < 0) return;
      if (this.settings.mentionSetting === 2) return;
      returnValue.props.children.splice(1, 0, React.createElement(SuppressedMentionComponent));
      const Message = Utils.findInTree(returnValue, (prop) => prop?.withMentionPrefix, { walkable: null });
      if (!Message) return;
      Message.withMentionPrefix = false;
    });
  }

  stop() {
    this.removeInterceptor("messageInterceptor");
    Patcher.unpatchAll(this.meta.name);
  }

  getSettingsPanel() {
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
          { label: "Default", value: 0 },
          { label: "Suppress Mentions", value: 1 },
          { label: "Force Mentions", value: 2 },
        ],
        onChange: (e) => {
          this.settings.mentionSetting = e;
          Data.save(this.meta.name, "settings", this.settings);
        },
      })
    );
  }
};
