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
      return;
  }
  ```
