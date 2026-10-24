import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/** Load a real module with isolated boundary dependencies, without connecting to services. */
export function loadModule<T>(
  file: string,
  imports: Record<string, unknown>,
  globals: Record<string, unknown> = {},
): T {
  const filename = path.resolve(file);
  const require = createRequire(filename);
  const compiledModule = { exports: {} };
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;

  runInNewContext(source, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: (name: string) => name in imports ? imports[name] : require(name),
    console,
    process,
    Buffer,
    URL,
    URLSearchParams,
    Request,
    Response,
    Headers,
    File,
    FormData,
    Uint8Array,
    TextEncoder,
    TextDecoder,
    ReadableStream,
    TransformStream,
    fetch,
    crypto,
    setTimeout,
    clearTimeout,
    ...globals,
  }, { filename });
  return compiledModule.exports as T;
}
