import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
/// <reference types="vitest" />

export default defineConfig(() => ({
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress warnings about unused imports from external modules
        if (warning.code === "UNUSED_EXTERNAL_IMPORT") {
          return;
        }
        // Suppress "use client" directive warnings from React Query
        if (
          warning.message?.includes("Module level directives cause errors when bundled")
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
  plugins: [
    devtools(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      target: "netlify",
      customViteReactPlugin: true,
      tsr: {
        quoteStyle: "double",
        semicolons: true,
        routesDirectory: "./src/routes",
        generatedRouteTree: "./src/routeTree.gen.ts",
        routeFileIgnorePattern: "__tests__",
      },
    }),
    viteReact({
      // https://react.dev/learn/react-compiler
      babel: {
        plugins: [
          [
            "babel-plugin-react-compiler",
            {
              target: "19",
            },
          ],
        ],
      },
    }),
    tailwindcss(),
  ],
  test: {
    environment: "node",
    globals: true,
    include: [
      "src/**/*.{test,spec}.ts",
      "src/**/*.{test,spec}.tsx",
      "tests/**/*.{test,spec}.ts",
    ],
    coverage: {
      reporter: ["text", "html"],
    },
  },
}));
