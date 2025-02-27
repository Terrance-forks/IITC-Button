module.exports = {
  filenameHashing: false,
  productionSourceMap: false,
  pages: {
    background: {
      template: "public/browser-extension.html",
      entry: "src/background/background.js",
      title: "background"
    },
    popup: {
      template: "public/browser-extension.html",
      entry: "./src/popup/main.js",
      title: "IITC Button popup"
    },
    jsview: {
      template: "public/browser-extension.html",
      entry: "./src/jsview/main.js",
      title: "IITC Button view",
      filename: "jsview.html"
    },
    settings: {
      template: "public/browser-extension.html",
      entry: "./src/settings/main.js",
      title: "IITC Button choose file",
      filename: "settings.html"
    }
  },
  pluginOptions: {
    browserExtension: {
      componentOptions: {
        contentScripts: {
          entries: {
            "content-script": ["src/content-scripts/loader.js"]
          }
        }
      },
      manifestTransformer: manifest => {
        if (process.env.BROWSER === "safari-ios") {
          manifest.background.persistent = false;
        }
        return manifest;
      }
    }
  }
};
