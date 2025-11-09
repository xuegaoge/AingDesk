# 调用 MCP 解决 bug 总结

## 背景
- 前端运行：`http://localhost:5173`；后端：`http://localhost:7071`。
- 通过 Claude Code 的 MCP FileSystem 工具在 Windows 下执行文件读写，出现路径与参数相关错误。
- 典型错误在前端会话中显示为：
  - `Error: Parent directory does not exist: C:\\AingDesk:\\\\work`
  - `Error: ENOENT: no such file or directory, open 'C:\\AingDesk\\121.txt'`
  - `Error: Invalid arguments for write_file: ... path Required`

## 根因分析
- 技术层面具体问题
  - 参数优先级不一致：服务端对 FileSystem 的写入类工具优先解析 `path` 字段；客户端有时仅提供 `file_path` 或传入含噪的 `path`，导致缺参或错误路径。
  - 路径清洗不充分：仅处理正斜杠，未统一反斜杠；存在中英文引号残留，产生多余字符；缺少“绝对 Windows 路径”的兜底，导致被视为相对路径，与应用根拼接。
  - 绝对路径被错误拼接：服务端把非绝对或无盘符的 `path` 与应用根 `C:\\AingDesk` 拼接，形成非法形态 `C:\\AingDesk:\\\\work`。
- 触发条件
  - 文本指令中包含中文引号/英文引号或混合斜杠；仅传 `file_path` 未同时传 `path`；存在 `file/filename` 等模糊字段。
  - 写入/追加操作更容易暴露（相较读取），因为服务端严格要求 `path`。
- 流程与影响范围（含显示内容）
  - 流程：前端聊天输入 → Claude Code解析 → MCP 客户端参数映射（`ensureFilePathArg`）→ 路径清洗（`sanitizeFilePath`）→ 服务端解析并执行。
  - 影响范围：Windows 下 FileSystem 工具（`write_file`、`read_text_file`、可能还有 `append_file`/`read_file`）。
  - 显示的内容：前端卡片出现 `调用结果: [FileSystem--write_file]` 或 `[FileSystem--read_text_file]`，错误时显示上述报错文本；修复后显示 `Successfully wrote to D:\\work\\121.txt` 与纯文本读取结果。

## 处理过程
1) 问题定位方法
  - 用 Playwright 驱动前端复现，捕捉页面中的“调用结果”与报错，核对是否为写入场景特有。
  - 分析 `c:\\AingDesk\\electron\\service\\mcp_client.ts` 中的 `sanitizeFilePath` 与 `ensureFilePathArg`，比对生成的参数与服务端期望。
  - 通过日志打印（`provided/candidate/sanitized`）观察路径提取与清洗的全过程。

2) 采用的解决方案
  - 路径清洗（`sanitizeFilePath`）：
    - 统一所有斜杠为单反斜杠；剥离中英文引号；去除多余空白；
    - 若存在可信盘符，直接采纳；否则在有 `preferCandidate` 时进行绝对路径兜底，最终确保为 Windows 绝对路径。
  - 参数映射（`ensureFilePathArg`）：
    - 针对 FileSystem 工具同时设置 `file_path` 与 `path` 为同一个清洗后的绝对路径；
    - 清理模糊或相对字段（`file`、`filename`），避免服务端选错；
    - 保持原有日志，以便后续排查。

3) 验证修复效果的测试方案
  - 测试方法：在同一会话中执行多轮“读-追加-读”，每次明确工具与参数，要求仅返回纯文本。
  - 步骤与样例：
    - 追加：向 `D:\\work\\121.txt` 末尾依次追加 `APPEND_TEST_4`、`APPEND_TEST_5`、`APPEND_TEST_6`；
    - 读取：直接调用 `FileSystem--read_text_file`，参数 `{ file_path: "D:\\work\\121.txt" }`，明确要求“仅返回纯文本内容”。
  - 期望结果：
    - 写入时显示 `Successfully wrote to D:\\work\\121.txt`；
    - 读取返回纯文本 `aaaaaaaaaaaaaAPPEND_TEST_1APPEND_TEST_2APPEND_TEST_3APPEND_TEST_4APPEND_TEST_5APPEND_TEST_6`；
    - 不再出现 `Parent directory does not exist`、`EISDIR`、`path Required` 等错误。

## 修改范围与注意事项
- 修改源文件：`electron\\service\\mcp_client.ts`（实际编译前代码）。
- 未修改：`public\\electron\\service`（编译后生成，不应直接改）。
- 环境提示：如需再次运行前端，先释放 `5173` 端口；Claude Code 调试日志位于 `C:\\Users\\Administrator\\.claude\\debug`。

## 风险与后续建议
- 风险：同一策略需适配其他 MCP 服务端（如 `excel-mcp-server`），关注其参数命名差异。
- 建议：
  - 读取/写入统一走“显式工具名 + 绝对路径 + 仅返回纯文本”；
  - 增加更多参数名容错映射（如存在 `filepath`/`target` 等别名时的处理）；
  - 根据需要扩展“覆盖写入/仅追加”模式可选项。

## 附：典型错误与成功样例
- 典型错误：
  - `Error: Parent directory does not exist: C:\\AingDesk:\\\\work`
  - `Error: Invalid arguments for write_file: [ { code: "invalid_type", expected: "string", received: "undefined", path: [ "path" ], message: "Required" } ]`
- 成功样例：
  - `调用结果: [FileSystem--write_file]` → `Successfully wrote to D:\\work\\121.txt`
  - `调用结果: [FileSystem--read_text_file]` → `aaaaaaaaaaaaaAPPEND_TEST_1...APPEND_TEST_6`

