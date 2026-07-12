# CLI Design & Argument Parsing Choices

This document outlines the architectural decisions and parser behaviors identified when refactoring the `cf-headers` CLI to use [CAC](https://github.com/cacjs/cac).

## 1. Option Precedence & Negative Flag Handling (`--strict` / `--no-strict`)

### The Problem
We require three states for the `strict` flag to honor user configurations correctly:
1. `--strict`: Forces strict validation (`true`).
2. `--no-strict`: Forces warnings-only validation (`false`).
3. Omitted: Defers to the configuration file (`undefined`), falling back to `true` if not configured.

In `cac`, defining a negative option like `.option('--no-strict', '...')` automatically assigns a default value of `true` to `strict` when the option is omitted. This would overwrite any `strict: false` defined in the user's config file.

### The Solution
Instead of defining `--no-strict`, we register only the positive version:
```ts
cli.option('--strict', 'Enable strict validation');
```

`cac` handles negation flags implicitly. By only registering `--strict`, we achieve the desired three-state parsing:
* **No flags passed:** `options.strict` is `undefined` (correctly allowing fallback to `config.strict`).
* **`--strict` passed:** `options.strict` resolves to `true`.
* **`--no-strict` passed:** `options.strict` resolves to `false`.

---

## 2. Default Command and Subcommand Alias Routing

### The Requirements
We support three commands:
1. `build` (the default action, runs when no command name is provided, e.g. `cf-headers`).
2. `list-headers`.
3. `inspect <name>`.

### The Implementation
To support both implicit execution (`cf-headers`) and explicit build runs (`cf-headers build`), we declare a default command with an alias:
```ts
cli
  .command('[command]', 'Generate _headers from your config file')
  .alias('build')
```

### Routing Logic
* **Implicit Run (`cf-headers`) & Explicit Run (`cf-headers build`):** Matches the default command, and the first argument (`command`) resolves to `undefined`.
* **Subcommands (`list-headers`, `inspect`):** `cac` evaluates command matches first, so they are routed correctly to their respective action handlers.
* **Typos/Unknown Commands (`cf-headers foo`):** Matches the default command, where the action handler receives `foo` as the first argument. We intercept this in the action callback, log the error, and print help:
  ```ts
  if (command !== undefined && command !== 'build') {
      console.error(`[cf-headers] Unknown command: ${command}`);
      cli.outputHelp();
      process.exitCode = 1;
  }
  ```

---

## 3. CAC Documentation Gaps & Behavioral Quirks

During implementation, we identified several gaps and undocumented behaviors in CAC's documentation:

### Implicit Negation Support
* **What the docs say:** The documentation suggests that to support negated boolean options (e.g. `--no-strict`), you must explicitly register `.option('--no-strict', '...')`.
* **The Reality / Discrepancy:** Explicitly registering `--no-strict` forces the option value to default to `true` when omitted. If you want a three-state option (allowing `undefined` to fallback to config files), you should **only** register `.option('--strict', '...')`. CAC implicitly parses `--no-strict` to `false` without requiring explicit registration, keeping the default state `undefined`.

### Default Command and Alias Interaction
* **What the docs say:** The documentation shows default commands using variadic brackets (e.g. `cli.command('[...files]')`) and subcommand registration separately, but does not cover mixing them with aliases or custom routing logic.
* **The Reality / Discrepancy:** Registering `.command('[command]').alias('build')` routes both the empty execution and the word `build` to the same action handler. However:
  * For `cf-headers build`, the command parameter is matched to the alias and passed to the action as `undefined` (matching the empty execution).
  * For unknown positionals (e.g. `cf-headers foo`), the parameter resolves as the string `"foo"`.
  This enables us to successfully distinguish unknown commands from the default command, but it is not documented in CAC's command-resolution lifecycle.
