import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import { getDefaultSelectors } from "eslint-plugin-better-tailwindcss/defaults";

const TOKENS_HINT = "Use a token from src/app/globals.css, or add one there.";

// Where lint looks for class strings: className, cn()-style helpers, constants named
// *Classes or *_CLASSES, and `className` keys in object literals. Class strings anywhere
// else go unchecked, so CLAUDE.md asks to keep them in these places. The plugin matches
// these patterns against the whole name or path.
const CLASS_SELECTORS = [
  ...getDefaultSelectors(),
  {
    kind: "variable",
    name: "^.*(?:Classes|_CLASSES)$",
    match: [{ type: "strings" }, { type: "objectValues" }],
  },
  {
    kind: "variable",
    name: "^.+$",
    match: [{ type: "objectValues", path: "^(?:.*\\.)?className$" }],
  },
];

const COLOR_FUNCTION = "\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|light-dark)\\(";
const RAW_COLOR_MESSAGE = `Raw colors bypass the design tokens. ${TOKENS_HINT}`;

const CSS_IMPORTS = {
  group: ["*.css"],
  message: "Style with token utilities. Only the root layout imports CSS.",
};
// The reader carries the AI SDK, so it loads with the first day played (useDayStream);
// a static import would put it back on the landing (docs/decisions.md, "The first screen asks one
// question, and no day is drawn until a press").
const EAGER_READER = {
  group: ["@/lib/stream/read-day-stream"],
  message: "Play days through useDayStream, which loads the reader when a day plays.",
};

// The layers of src, as ARCHITECTURE.md's "How the layers import" states them. A pattern
// matches an import of a top folder of src by its alias or by a relative path. Only static
// imports and re-exports are read: the rule does not see import().
const SRC_FOLDER = "^(?:@/|(?:\\.\\./)+)";
const LAYERS_HINT = 'ARCHITECTURE.md, "How the layers import".';
const APP_IMPORTS = {
  regex: `${SRC_FOLDER}app(?:/|$)`,
  message: `Nothing outside src/app imports a route or a page, but tests. ${LAYERS_HINT}`,
};
const EVAL_IMPORTS = {
  regex: `${SRC_FOLDER}eval(?:/|$)`,
  message: `Only src/eval itself, scripts and tests import the paid eval. ${LAYERS_HINT}`,
};
const FEATURE_IMPORTS = {
  regex: `${SRC_FOLDER}features(?:/|$)`,
  message: `The features build on this layer, so it imports none of them. ${LAYERS_HINT}`,
};
const LIB_BEYOND_TOKENS = {
  regex: `${SRC_FOLDER}lib/(?!tokens(?:/|$))`,
  message: `The primitives build on the design tokens alone, from src/lib/tokens. ${LAYERS_HINT}`,
};

// Flat config does not merge a rule's options across blocks: the last block that matches a
// file replaces them whole. So every block below that sets this rule lists all the patterns
// its files answer to, and one that loosens how a file styles or plays a day keeps its layer's.
function restrictImports(...patterns) {
  return { "no-restricted-imports": ["error", { patterns }] };
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Design tokens are the only source of visual values. The theme is closed, so a class
  // Tailwind does not know is off-token; arbitrary values and hex colors bypass it.
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": { entryPoint: "src/app/globals.css", selectors: CLASS_SELECTORS },
    },
    rules: {
      "better-tailwindcss/no-unknown-classes": "error",
      "better-tailwindcss/no-restricted-classes": [
        "error",
        {
          restrict: [
            {
              pattern: "[\\[(]",
              message: `Arbitrary values bypass the design tokens. ${TOKENS_HINT}`,
            },
            {
              pattern: "(^|:)(duration|delay)-",
              message: "Transition timing comes from the motion tokens, not per class.",
            },
            {
              pattern: "(^|:)dark:",
              message: "Colors switch themes inside their tokens; never override them per class.",
            },
            {
              pattern: "(^|:)outline-(none|hidden)$",
              message: "Focus must stay visible. Restyle it with tokens instead of removing it.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        // Whole-string hex only, so text such as "Order #1042" stays legal.
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message: RAW_COLOR_MESSAGE,
        },
        { selector: `Literal[value=/${COLOR_FUNCTION}/]`, message: RAW_COLOR_MESSAGE },
        { selector: `TemplateElement[value.raw=/${COLOR_FUNCTION}/]`, message: RAW_COLOR_MESSAGE },
        {
          selector: "JSXAttribute[name.name='style'] Literal",
          message: `Inline styles may carry Motion values, not visual values. ${TOKENS_HINT}`,
        },
      ],
      ...restrictImports(CSS_IMPORTS, EAGER_READER),
    },
  },
  // The layers, each block for one folder of src; a feature, src/proxy.ts and any new folder
  // take the first. Features import each other, which no rule here checks.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: restrictImports(CSS_IMPORTS, EAGER_READER, APP_IMPORTS, EVAL_IMPORTS),
  },
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: restrictImports(CSS_IMPORTS, EAGER_READER, EVAL_IMPORTS),
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: restrictImports(
      CSS_IMPORTS,
      EAGER_READER,
      APP_IMPORTS,
      EVAL_IMPORTS,
      FEATURE_IMPORTS,
      LIB_BEYOND_TOKENS,
    ),
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: restrictImports(CSS_IMPORTS, EAGER_READER, APP_IMPORTS, EVAL_IMPORTS, FEATURE_IMPORTS),
  },
  {
    // The paid eval may read a feature, which is why it sits beside src/lib: the re-plan round
    // reads a stream as the page draws it (`replanFrameOf`).
    files: ["src/eval/**/*.{ts,tsx}"],
    rules: restrictImports(CSS_IMPORTS, EAGER_READER, APP_IMPORTS),
  },
  {
    // The root layout imports the stylesheet.
    files: ["src/app/layout.tsx"],
    rules: restrictImports(EAGER_READER, EVAL_IMPORTS),
  },
  {
    // Drawn in the root layout's place when the layout itself fails, so it brings the same
    // stylesheet: Next includes none of the layout's in it.
    files: ["src/app/global-error.tsx"],
    rules: restrictImports(EAGER_READER, EVAL_IMPORTS),
  },
  {
    // The lab reads streams on purpose and never ships on the landing.
    files: ["src/app/lab/**/*.{ts,tsx}"],
    rules: restrictImports(CSS_IMPORTS, EVAL_IMPORTS),
  },
  {
    // The live routes run on the server only, where they read the stream they send to log
    // its outcome.
    files: ["src/lib/live/**/*.{ts,tsx}"],
    rules: restrictImports(CSS_IMPORTS, APP_IMPORTS, EVAL_IMPORTS, FEATURE_IMPORTS),
  },
  {
    // Tests read streams on purpose, and import across the layers freely, routes included.
    files: ["**/*.test.*"],
    rules: restrictImports(CSS_IMPORTS),
  },
  {
    // A spec takes `test` from e2e/fixtures.ts, so E2E_CPU_RATE slows its page as well.
    files: ["e2e/*.spec.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [CSS_IMPORTS, EAGER_READER],
          paths: [
            {
              name: "@playwright/test",
              importNames: ["test"],
              message: "Take test from ./fixtures, which slows the page when E2E_CPU_RATE is set.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".next-e2e/**",
    // A build directory of an e2e server the run no longer starts, which a checkout may still hold.
    ".next-e2e-fi/**",
    // `pnpm build:check`'s production build, apart from the dev server's `.next`.
    ".next-build/**",
    ".claude/worktrees/**",
    // The review probes are CommonJS command-line scripts that print to the console.
    ".claude/skills/*/tools/**",
    "coverage/**",
    "playwright-report/**",
    ".playwright-mcp/**",
    "test-results/**",
    // Working notes, which git ignores: a script kept there is not the repository's.
    "notes/**",
  ]),
]);

export default eslintConfig;
