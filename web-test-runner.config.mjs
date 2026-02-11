import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import alias from "@rollup/plugin-alias";
import { esbuildPlugin } from "@web/dev-server-esbuild";
import { fromRollup } from "@web/dev-server-rollup";
import { chromeLauncher } from "@web/test-runner-chrome";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname);

const aliasPlugin = fromRollup(alias)({
  entries: [
    {
      find: /^@\/(.*)$/,
      replacement: path.join(projectRoot, "src", "$1"),
    },
  ],
  include: ["**/*.ts", "**/*.tsx"],
});

/**
 * Custom plugin to serve .wgsl files as raw text (ES module that default-exports
 * the file contents as a string). This mirrors webpack's `asset/source` behavior
 * from craco.config.js so shader imports work identically in tests.
 */
function wgslPlugin() {
  return {
    name: "wgsl-raw-loader",
    resolveMimeType(context) {
      if (context.path.endsWith(".wgsl")) {
        return "js";
      }
    },
    transform(context) {
      if (context.path.endsWith(".wgsl")) {
        const filePath = path.join(projectRoot, context.path);
        const source = fs.readFileSync(filePath, "utf-8");
        return {
          body: `export default ${JSON.stringify(source)};`,
        };
      }
    },
  };
}

export default {
  files: "test/**/*.test.ts",
  nodeResolve: true,

  browsers: [
    chromeLauncher({
      launchOptions: {
        args: [
          // Expose WebGPU in headless Chromium
          "--enable-unsafe-webgpu",
          "--enable-features=Vulkan",
        ],
      },
    }),
  ],

  plugins: [
    wgslPlugin(),
    aliasPlugin,
    esbuildPlugin({
      ts: true,
      tsconfig: "./tsconfig.json",
    }),
  ],
};
