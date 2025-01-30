/**
 * @name JumpToTop
 * @author Huderon
 * @description Adds a button to the channel header allowing you to jump to first message in a channel.
 * @version 1.0.4
 */

"use strict";

// src/plugins/JumpToTop/components/ToolbarComponent.jsx
var IconWrapperClasses = BdApi.Webpack.getByKeys("iconWrapper", "clickable");
var IconClasses = BdApi.Webpack.getByKeys("browser", "icon");
var Tooltip = BdApi.Components?.Tooltip;
var transitionTo = BdApi.Webpack.getByStrings("transitionTo - Transitioning to", {searchExports: true});
function ToolbarComponent() {
	return /* @__PURE__ */ BdApi.React.createElement(Tooltip, {text: "Jump To Top"}, ({onMouseEnter, onMouseLeave}) =>
		/* @__PURE__ */ BdApi.React.createElement(
			"div",
			{
				className: `${IconClasses.icon} ${IconWrapperClasses.iconWrapper} ${IconWrapperClasses.clickable}`,
				onMouseEnter,
				onMouseLeave,
				onClick: () => {
					transitionTo(location.pathname + "/0");
				},
			},
			/* @__PURE__ */ BdApi.React.createElement(
				"svg",
				{
					"className": IconWrapperClasses.icon,
					"aria-hidden": "true",
					"role": "img",
					"width": "24",
					"height": "24",
					"fill": "none",
					"viewBox": "0 0 24 24",
				},
				/* @__PURE__ */ BdApi.React.createElement("path", {
					fill: "currentColor",
					d: "M 13.175373,22.074627 V 10.152985 l 3.69403,3.69403 c 0.335821,0.503731 1.175373,0.503731 1.511194,0.16791 0.503731,-0.335821 0.503731,-1.175373 0.16791,-1.511194 0,0 0,0 -0.16791,-0.16791 L 12.839552,6.6268657 c -0.503731,-0.5037314 -1.175373,-0.5037314 -1.511194,0 L 5.619403,12.335821 c -0.3358209,0.503731 -0.3358209,1.175373 0.1679104,1.511194 0.3358209,0.335821 1.0074627,0.335821 1.5111941,0 l 3.6940295,-3.69403 v 11.921642 c 0,0.671642 0.503732,1.175373 1.175373,1.175373 0.503732,-0.16791 1.007463,-0.503731 1.007463,-1.175373 z M 1.9253731,0.75 C 1.2537313,0.75 0.75,1.2537313 0.75,1.9253731 c 0,0.6716418 0.5037313,1.1753732 1.1753731,1.1753732 H 22.074627 C 22.746269,3.1007463 23.25,2.5970149 23.25,1.9253731 23.25,1.2537313 22.746269,0.75 22.074627,0.75 Z",
				}),
			),
		),
	);
}

// src/plugins/JumpToTop/index.jsx
var [ChannelHeader, ChannelHeaderKey] = BdApi.Webpack.getWithKey(BdApi.Webpack.Filters.byKeys("Icon", "Divider"));
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
