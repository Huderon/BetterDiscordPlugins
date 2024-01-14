/**
 * @name FileViewer
 * @author AGreenPig, Huderon
 * @description View Pdf and other files directly in Discord.
 * @version 3.0.0
 */

const { Webpack, DOM, Patcher, React } = BdApi;
const Tooltip = Webpack.getByKeys("Tooltip").Tooltip;
const ButtonClasses = Webpack.getByKeys("button", "buttonContent");
const EmbedClasses = BdApi.Webpack.getByKeys("embedWrapper");
const AttachmentWrapper = Webpack.getByKeys("AttachmentUpload");

const fileExtensions = {
  office: ["ppt", "pptx", "doc", "docx", "xls", "xlsx", "odt"],
  google: ["pdf"],
  object: ["stl", "obj", "vf", "vsj", "vsb", "3mf"],
};

const extensionSources = Object.entries(fileExtensions).reduce(
  (extensionMap, [category, extensions]) => {
    switch (category) {
      case "office":
        baseUrl = "https://view.officeapps.live.com/op/view.aspx?src=";
        break;
      case "google":
        baseUrl = "https://drive.google.com/viewerng/viewer?embedded=true&url=";
        break;
      case "object":
        baseUrl = "https://www.viewstl.com/?embedded&url=";
        break;
    }

    extensions.forEach((extension) => (extensionMap[extension] = baseUrl));
    return extensionMap;
  },
  {}
);

const ShowIconPath =
  "M 12,3.2727275 C 3.272727,3.2727275 -4.9999999e-8,12.000001 -4.9999999e-8,12.000001 -4.9999999e-8,12.000001 3.272727,20.727273 12,20.727273 c 8.727273,0 12,-8.727272 12,-8.727272 0,0 -3.272727,-8.7272736 -12,-8.7272735 z m 0,3.2727269 c 3.012,0 5.454545,2.4425461 5.454545,5.4545466 0,3.012 -2.442546,5.454545 -5.454545,5.454545 -3.012,0 -5.454545,-2.442546 -5.454545,-5.454545 0,-3.0120015 2.442546,-5.4545466 5.454545,-5.4545466 z m 0,2.1818181 c -1.807477,0 -3.272727,1.4652505 -3.272727,3.2727285 0,1.807477 1.46525,3.272727 3.272727,3.272727 1.807477,0 3.272727,-1.46525 3.272727,-3.272727 0,-1.807478 -1.46525,-3.2727286 -3.272727,-3.2727285 z";
const HideIconPath =
  "m 3.2432461,2.1361415 c -0.445381,1.17e-4 -0.846283,0.270075 -1.013877,0.682722 -0.167593,0.412645 -0.06846,0.885692 0.250714,1.196326 l 1.951729,1.951729 c -2.114443,1.698129 -3.485625,3.780181 -4.1642586,5.0022415 -0.3633761,0.654516 -0.3514392,1.442476 0.00427,2.10137 1.2641566,2.340057 4.8985886,7.68293 11.7381665,7.68293 2.271725,0 4.165699,-0.596803 5.737615,-1.470745 L 19.9922,21.52731 c 0.274521,0.285931 0.682171,0.401111 1.065732,0.30112 0.383562,-0.09999 0.683098,-0.399528 0.783089,-0.78309 0.09999,-0.383562 -0.01519,-0.791211 -0.301119,-1.065731 L 4.0277861,2.4674865 c -0.206065,-0.211822 -0.489021,-0.331328 -0.78454,-0.331345 z m 8.7667489,1.105197 c -1.326543,0 -2.5110229,0.218593 -3.5934909,0.56008 l 2.8025379,2.802539 c 0.259399,-0.03831 0.520609,-0.0791 0.790953,-0.0791 3.021936,0 5.472538,2.450603 5.472538,5.4725365 0,0.270344 -0.04079,0.531555 -0.07909,0.790953 l 3.753819,3.75382 c 1.175502,-1.304654 2.035869,-2.627998 2.550289,-3.507983 0.387455,-0.661083 0.385899,-1.473139 0.01924,-2.146261 C 22.447312,8.5314485 18.816745,3.2413345 12.010002,3.2413345 Z m -4.5597359,5.744026 1.601145,1.6011455 c -0.206551,0.426738 -0.324932,0.903655 -0.324932,1.410888 0,1.8136 1.4699229,3.283523 3.2835229,3.283523 0.507232,0 0.984149,-0.118382 1.410888,-0.324932 l 1.603284,1.603284 c -1.087457,0.721052 -2.444386,1.066541 -3.890632,0.842258 -2.2962769,-0.35681 -4.1708609,-2.231394 -4.5276699,-4.52767 -0.224185,-1.445609 0.12396,-2.801277 0.844395,-3.8884945 z";

function getSourceUrl(url) {
  const fileExtension = new URL(url).pathname.toLowerCase().split(".").pop();
  const viewerUrl = extensionSources[fileExtension];
  return viewerUrl ? viewerUrl + url : null;
}

function ButtonComponent({ isShown, onToggle }) {
  return React.createElement(
    Tooltip,
    { text: `${isShown ? "Hide" : "Show"} File Preview` },
    ({ onMouseEnter, onMouseLeave }) =>
      React.createElement(
        "div",
        {
          className: `${ButtonClasses.button} fileViewerButton`,
          onClick: onToggle,
          onMouseEnter,
          onMouseLeave,
        },
        React.createElement(
          "svg",
          {
            className: ButtonClasses.icon,
            "aria-hidden": "true",
            role: "img",
            width: "24",
            height: "24",
            fill: "none",
            viewBox: "0 0 24 24",
          },
          React.createElement("path", {
            fill: "currentColor",
            d: `${isShown ? HideIconPath : ShowIconPath}`,
          })
        )
      )
  );
}

function IframeComponent({ url, isShown }) {
  if (!isShown) return null;

  return React.createElement("iframe", {
    className: `${EmbedClasses.embedWrapper} embedFileViewer`,
    src: getSourceUrl(url),
    width: "360px",
    height: "500px",
  });
}

function FileViewerComponent({ url }) {
  const [isShown, setIsShown] = React.useState(false);

  const handleClick = () => {
    setIsShown((prevIsShown) => !prevIsShown);
  };

  return [
    React.createElement(ButtonComponent, {
      isShown,
      onToggle: handleClick,
    }),
    React.createElement(IframeComponent, { url, isShown }),
  ];
}

const styles = `
  .attachment_f3cf2c {
    flex-wrap: wrap;
  }
  .attachment_f3cf2c.newMosaicStyle__235c9 {
    min-width: 432px;
    width: auto;
  }
  .embedFileViewer {
    border-radius: 8px;
    margin-top: 16px;
    width: 100%;
  }
`;

module.exports = class FileViewer {
  constructor(meta) {
    this.meta = meta;
  }

  start() {
    Patcher.after(
      this.meta.name,
      AttachmentWrapper,
      "default",
      (_, [{ url }], returnValue) => {
        returnValue.props.children[0].props.children.push(
          React.createElement(FileViewerComponent, { url })
        );
      }
    );
    DOM.addStyle(this.meta.name, styles);
  }

  stop() {
    Patcher.unpatchAll(this.meta.name);
    DOM.removeStyle(this.meta.name);
  }
};
