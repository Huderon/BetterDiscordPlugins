/**
 * @name SuppressReplyMentions
 * @description Suppresses mentions from Replied messages and when replying to someone else.
 * @author Strencher, Huderon
 * @version 1.0.0
 */

const { Data, Webpack, Patcher, React } = BdApi;
const Dispatcher = Webpack.getByKeys("actionLogger");
const { Tooltip, FormSwitch, FormItem, SingleSelect } = Webpack.getByKeys("Tooltip", "FormSwitch");
const UserStore = Webpack.getStore("UserStore");
const replyActions = Webpack.getByKeys("createPendingReply");
const RepliedMessageComponent = Webpack.getByKeys("renderSingleLineMessage");

const currentUser = UserStore.getCurrentUser();
const suppressed = [];
const settings = {
  disableMention: true,
  mentionSetting: 1,
  allowManualPing: false,
};

function removeInterceptor(value) {
  const interceptors = Dispatcher._interceptors;
  const index = interceptors.findIndex((func) => func.name === value);
  if (index > -1) {
    interceptors.splice(index, 1);
  }
  return interceptors;
}

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
  }

  messageInterceptor({ type, message }) {
    if (type != "MESSAGE_CREATE") return;
    if (!message.referenced_message) return;

    if (settings.allowManualPing) {
      const manualPing = "<@" + currentUser.id + ">";
      if (message.content.includes(manualPing)) return;
    }

    const mentionIndex = message.mentions.findIndex((e) => e.id === currentUser.id);

    switch (settings.mentionSetting) {
      case 1:
        if (message.referenced_message.author.id === currentUser.id && mentionIndex > -1) {
          message.mentions.splice(mentionIndex, 1);
          suppressed.push(message.id);
        }
        break;
      case 2:
        if (message.referenced_message.author.id === currentUser.id && mentionIndex === -1) {
          message.mentions.push(currentUser);
        }
        break;
      default:
        return;
    }
  }

  start() {
    Object.assign(settings, Data.load("SuppressReplyMentions", "settings"));
    Dispatcher.addInterceptor(this.messageInterceptor);
    Patcher.before(this.meta.name, replyActions, "createPendingReply", (_, [args]) => {
      if (!settings.disableMention) return;
      args.shouldMention = false;
    });
    Patcher.after(this.meta.name, RepliedMessageComponent, "default", (_, [args], returnValue) => {
      if (suppressed.indexOf(args.baseMessage.id) < 0) return;
      returnValue.props.children.splice(1, 0, React.createElement(SuppressedMentionComponent));
    });
  }

  stop() {
    removeInterceptor("messageInterceptor");
    Patcher.unpatchAll(this.meta.name);
  }

  getSettingsPanel() {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(FormSwitchWrapper, {
        label: "Disable Mention",
        description: "Automatically disables the 'Mention' option when replying to someone else.",
        value: settings.disableMention,
        onChange: (e) => {
          settings.disableMention = e;
          Data.save(this.meta.name, "settings", settings);
        },
      }),
      React.createElement(FormSwitchWrapper, {
        label: "Allow Manual Pings",
        description: "Allow manual pings to mention even if they are in replies.",
        value: settings.allowManualPing,
        onChange: (e) => {
          settings.allowManualPing = e;
          Data.save(this.meta.name, "settings", settings);
        },
      }),
      React.createElement(SingleSelectWrapper, {
        title: "Mention Settings",
        value: settings.mentionSetting,
        options: [
          { label: "Default", value: 0 },
          { label: "Suppress Mentions", value: 1 },
          { label: "Force Mentions", value: 2 },
        ],
        onChange: (e) => {
          settings.mentionSetting = e;
          Data.save(this.meta.name, "settings", settings);
        },
      })
    );
  }
};
