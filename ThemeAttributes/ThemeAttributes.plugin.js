/**
 * @name ThemeAttributes
 * @author Huderon
 * @description Adds data attributes to various elements for theming purposes.
 * @version 0.0.1
 */

const { Webpack, Patcher, Utils } = BdApi;
const MessageComponent = Webpack.getByStrings("isSystemMessage", "hasReply", { defaultExport: false });
const TabBarComponent = Webpack.getByKeys("TabBar")?.TabBar;
const UserProfileComponent = Webpack.getModule((m) => m.render?.toString?.().includes(".ThemeContextProvider"));

module.exports = class ThemeAttributes {
  constructor(meta) {
    this.meta = meta;
  }

  start() {
    Patcher.before(this.meta.name, MessageComponent, "Z", (_, [args], returnValue) => {
      if (args['aria-roledescription'] !== "Message") return;
      const author = Utils.findInTree(args, (arg) => arg?.username, { walkable: ["props", "childrenMessageContent", "message", "author"] });
      const authorId = author?.id;
      if (!authorId) return;
      args['data-author-id'] = authorId;
      args['data-author-self'] = !!author.email;
    });
    Patcher.after(this.meta.name, TabBarComponent?.Item?.prototype, "render", (_, __, returnValue) => {
      returnValue.props['data-tab-id'] = returnValue?._owner?.pendingProps?.id;
    });
    Patcher.after(this.meta.name, TabBarComponent, "Header", (_, __, returnValue) => {
      returnValue.props['data-tab-header-id'] = returnValue.props.children.props.children;
    });
    Patcher.after(this.meta.name, UserProfileComponent, "render", (_, [{user}], returnValue) => {
      returnValue.props['data-member-id'] = user.id;
      returnValue.props['data-member-self'] = !!user.email;
    });
  }

  stop() {
    Patcher.unpatchAll(this.meta.name);
  }
};
