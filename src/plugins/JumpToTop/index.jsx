import {ToolbarComponent} from "./components/ToolbarComponent";

const [ChannelHeader, ChannelHeaderKey] = BdApi.Webpack.getWithKey(BdApi.Webpack.Filters.byKeys("Icon", "Divider"));

module.exports = class MentionFilter {
	constructor(meta) {
		this.meta = meta;
	}

	start() {
		BdApi.Patcher.after(this.meta.name, ChannelHeader, ChannelHeaderKey, (_, [{toolbar}], returnValue) => {
			const Toolbar = BdApi.Utils.findInTree(
				toolbar,
				(prop) => Array.isArray(prop) && prop.some((element) => element?.key === "pins"),
				{walkable: ["props", "children"]},
			);
			if (!Toolbar) return;
			Toolbar.unshift(BdApi.React.createElement(ToolbarComponent));
		});
	}

	stop() {
		BdApi.Patcher.unpatchAll(this.meta.name);
	}
};
