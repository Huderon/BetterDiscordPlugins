/**
 * @name ThemeAttributes
 * @author Huderon
 * @description Adds data attributes to various elements for theming purposes.
 * @version 0.0.1
 */

const { Webpack, Patcher, Utils } = BdApi;
const UserStore = Webpack.getStore("UserStore");
const CurrentUser = UserStore.getCurrentUser();
const MessageComponent = Webpack.getByStrings("isSystemMessage", "hasReply", { defaultExport: false });
const TabBarComponent = Webpack.getByKeys("TabBar")?.TabBar;
const UserProfileComponent = Webpack.getByKeys("UserProfileContext");

module.exports = class ThemeAttributes {
  constructor(meta) {
    this.meta = meta;
  }

  start() {
    Patcher.before(this.meta.name, MessageComponent, "default", (_, [args], returnValue) => {
      if (!args['aria-role-description'] === "Message") return;
      const author = Utils.findInTree(args, (arg) => arg?.username, { walkable: ["props", "childrenMessageContent", "message", "author"] });
      const authorId = author?.id;
      if (!authorId) return;
      args['data-author-id'] = authorId;
      args['data-author-self'] = authorId === CurrentUser.id;
    });
    Patcher.after(this.meta.name, TabBarComponent?.prototype?.constructor?.Item?.prototype, "render", (_, __, returnValue) => {
      returnValue.props['data-tab-id'] = returnValue?._owner?.pendingProps?.id;
    });
    Patcher.after(this.meta.name, UserProfileComponent, "default", (_, [{user}], returnValue) => {
      returnValue.props['data-member-id'] = user.id;
      returnValue.props['data-member-self'] = user.id === CurrentUser.id;
    });
  }

  stop() {
    Patcher.unpatchAll(this.meta.name);
  }
};
