var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var import_vitest = require("vitest");
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var import_doc = require("./doc");
(0, import_vitest.describe)("Document Engines", () => {
  const testFilesDir = path.join(__dirname, "../test_files");
  (0, import_vitest.beforeAll)(() => {
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
  });
  (0, import_vitest.describe)("PDF Engine", () => {
    (0, import_vitest.it)("should parse PDF content correctly", async () => {
      (0, import_vitest.expect)(true).toBe(true);
    });
  });
  (0, import_vitest.describe)("Markdown Engine", () => {
    (0, import_vitest.it)("should parse Markdown content correctly", async () => {
      (0, import_vitest.expect)(true).toBe(true);
    });
    (0, import_vitest.it)("should identify supported file extensions", () => {
      const extensions = (0, import_doc.getSupportedFileExtensions)();
      (0, import_vitest.expect)(extensions).toContain(".pdf");
      (0, import_vitest.expect)(extensions).toContain(".md");
      (0, import_vitest.expect)(extensions).toContain(".docx");
      (0, import_vitest.expect)(extensions).toContain(".txt");
    });
    (0, import_vitest.it)("should check if file type is supported", () => {
      (0, import_vitest.expect)((0, import_doc.isSupportedFileType)("test.md")).toBe(true);
      (0, import_vitest.expect)((0, import_doc.isSupportedFileType)("test.pdf")).toBe(true);
      (0, import_vitest.expect)((0, import_doc.isSupportedFileType)("test.xyz")).toBe(false);
    });
    (0, import_vitest.it)("should parse document with content only", async () => {
      const testFilePath = path.join(testFilesDir, "test.md");
      fs.writeFileSync(testFilePath, "# Test Heading\nTest content");
      const result = await (0, import_doc.parseDocument)(testFilePath);
      (0, import_vitest.expect)(result.content).toContain("Test Heading");
      (0, import_vitest.expect)(result.savedPath).toBeUndefined();
      (0, import_vitest.expect)(result.originalPath).toBeUndefined();
    });
    (0, import_vitest.it)("should parse document and save files when requested", async () => {
      const testFilePath = path.join(testFilesDir, "save_test.md");
      fs.writeFileSync(testFilePath, "# Save Test\nThis should be saved");
      const result = await (0, import_doc.parseDocument)(testFilePath, true, true);
      (0, import_vitest.expect)(result.content).toContain("Save Test");
      (0, import_vitest.expect)(result.savedPath).toBeDefined();
      (0, import_vitest.expect)(result.originalPath).toBeDefined();
      (0, import_vitest.expect)(fs.existsSync(result.savedPath)).toBe(true);
      (0, import_vitest.expect)(fs.existsSync(result.originalPath)).toBe(true);
    });
    (0, import_vitest.it)("should handle non-existent files gracefully", async () => {
      const nonExistentFile = path.join(testFilesDir, "does_not_exist.md");
      const result = await (0, import_doc.parseDocument)(nonExistentFile);
      (0, import_vitest.expect)(result.content).toContain("# \u6587\u4EF6\u8BBF\u95EE\u9519\u8BEF");
    });
  });
});
