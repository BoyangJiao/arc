/**
 * @arc/eslint-plugin-token-discipline — ADR 008 §决策六
 *
 * Enforces accent allowlist + soft-fill discipline after UI polish migration.
 */

const ACCENT_CLASS_RE = /\b(text|bg|border)-accent\b/;

/** Paths (suffix match) allowed to use solid accent utilities. */
const ACCENT_ALLOWLIST_SUFFIXES = [
  "packages/ui/src/navigation/FloatingTabBar.tsx",
  "packages/ui/src/wrappers/tab-bar-icons.tsx",
  "apps/mobile/app/welcome.tsx",
];

const FEEDBACK_COMPONENT_GLOBS = [
  /[/\\]Toast\.tsx$/,
  /[/\\]toast[/\\]/i,
  /[/\\]Banner\.tsx$/,
  /[/\\]banner[/\\]/i,
  /[/\\]Badge\.tsx$/,
  /[/\\]badge[/\\]/i,
  /[/\\]Chip\.tsx$/,
  /[/\\]chip[/\\]/i,
];

const HARD_FILL_RE = /\bbg-(accent|success|danger|warning)\b/;

function normalizePath(filename) {
  return filename.replaceAll("\\", "/");
}

function isAccentAllowlisted(filename) {
  const path = normalizePath(filename);
  return ACCENT_ALLOWLIST_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

function isFeedbackComponentFile(filename) {
  const path = normalizePath(filename);
  return FEEDBACK_COMPONENT_GLOBS.some((re) => re.test(path));
}

function collectClassStrings(node) {
  const values = [];
  if (!node?.value) return values;

  if (node.value.type === "Literal" && typeof node.value.value === "string") {
    values.push(node.value.value);
  }

  if (node.value.type === "TemplateLiteral") {
    for (const quasi of node.value.quasis) {
      if (typeof quasi.value?.raw === "string") {
        values.push(quasi.value.raw);
      }
    }
  }

  if (node.value.type === "JSXExpressionContainer") {
    const expr = node.value.expression;
    if (expr.type === "Literal" && typeof expr.value === "string") {
      values.push(expr.value);
    }
    if (expr.type === "TemplateLiteral") {
      for (const quasi of expr.quasis) {
        if (typeof quasi.value?.raw === "string") {
          values.push(quasi.value.raw);
        }
      }
    }
    if (expr.type === "CallExpression" && expr.callee?.name === "cn") {
      for (const arg of expr.arguments) {
        if (arg.type === "Literal" && typeof arg.value === "string") {
          values.push(arg.value);
        }
        if (arg.type === "TemplateLiteral") {
          for (const quasi of arg.quasis) {
            if (typeof quasi.value?.raw === "string") {
              values.push(quasi.value.raw);
            }
          }
        }
      }
    }
  }

  return values;
}

const noAccentOutsideAllowlist = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow solid accent utilities (text-accent / bg-accent / border-accent) outside ADR 008 allowlist",
    },
    messages: {
      accent:
        "Solid accent utility '{{match}}' is not allowed here (ADR 008 §决策一). Use neutral tokens, *-soft variants, or move to an allowlisted file.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (isAccentAllowlisted(filename)) {
      return {};
    }

    return {
      JSXAttribute(node) {
        if (node.name.name !== "className") return;
        for (const classString of collectClassStrings(node)) {
          const match = classString.match(ACCENT_CLASS_RE);
          if (match) {
            context.report({
              node,
              messageId: "accent",
              data: { match: match[0] },
            });
          }
        }
      },
    };
  },
};

const noHardFillInFeedbackComponents = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Toast / Banner / Badge / Chip wrappers must not use solid semantic fills (ADR 008 §决策三)",
    },
    messages: {
      hardFill:
        "Solid fill '{{match}}' in feedback component — use bg-{semantic}-soft instead (ADR 008 §决策三).",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!isFeedbackComponentFile(filename)) {
      return {};
    }

    return {
      JSXAttribute(node) {
        if (node.name.name !== "className") return;
        for (const classString of collectClassStrings(node)) {
          const match = classString.match(HARD_FILL_RE);
          if (match) {
            context.report({
              node,
              messageId: "hardFill",
              data: { match: match[0] },
            });
          }
        }
      },
    };
  },
};

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: {
    name: "@arc/eslint-plugin-token-discipline",
    version: "0.1.0",
  },
  rules: {
    "no-accent-outside-allowlist": noAccentOutsideAllowlist,
    "no-hard-fill-in-feedback-components": noHardFillInFeedbackComponents,
  },
};

export default plugin;
