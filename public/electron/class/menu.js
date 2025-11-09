var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var menu_exports = {};
__export(menu_exports, {
  ContextMenu: () => ContextMenu
});
module.exports = __toCommonJS(menu_exports);
var import_public = require("./public");
const { Menu, clipboard, shell } = require("electron");
class ContextMenu {
  event;
  params;
  constructor(event, params) {
    this.event = event;
    this.params = params;
  }
  /**
   * @name 创建右键菜单
   */
  get_context_menu() {
    let that = this;
    let template = [];
    if (that.params.selectionText) {
      if (that.params.selectionText) {
        template.push({
          id: 1,
          label: import_public.pub.lang("\u590D\u5236"),
          role: "copy"
        });
        template.push({
          id: 2,
          label: import_public.pub.lang("\u526A\u5207"),
          role: "cut"
        });
      }
    }
    let is_link = false;
    let clipboard_text = clipboard.readText();
    if (clipboard_text) {
      template.push({
        id: 3,
        label: import_public.pub.lang("\u7C98\u8D34"),
        role: "paste"
      });
    }
    template.push({
      id: 4,
      label: import_public.pub.lang("\u5168\u9009"),
      role: "selectAll"
    });
    if (that.params.selectionText) {
      is_link = that.params.selectionText.match(/(http|https):\/\/([\w.]+\/?)\S*/);
      if (is_link) {
        template.push({
          id: 6,
          label: import_public.pub.lang("\u6253\u5F00\u94FE\u63A5"),
          accelerator: "",
          click: function() {
            shell.openExternal(that.params.selectionText);
          }
        });
      }
    }
    return Menu.buildFromTemplate(template);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ContextMenu
});
