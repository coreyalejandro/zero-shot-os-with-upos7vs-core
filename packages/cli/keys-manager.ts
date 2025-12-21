#!/usr/bin/env node
/**
 * UPOS-7-VS Keys Manager (Local-First)
 *
 * Goal: stop re-exporting keys in every repo/session.
 *
 * Commands:
 *   npm run keys:status
 *   npm run keys:import-env
 *   npm run keys:set
 *   npm run keys:import-clipboard
 *   npm run keys:set-gui
 *
 * Notes:
 * - Stores keys in the global UPOS config file: ~/.upos7vs/config/config.json
 * - Does NOT print key values; only prints set/missing.
 */

import { ConfigManager, type UserConfig } from "../core/config.js";
import readline from "node:readline";
import * as readlinePromises from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { execSync, execFileSync } from "node:child_process";
import os from "node:os";

const SYMBOLS = { ok: "✅", warn: "⚠️", err: "❌", info: "ℹ️" } as const;

function getEnvKey(name: string): string | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : undefined;
}

function safeStatus(label: string, present: boolean) {
  console.log(`${present ? SYMBOLS.ok : SYMBOLS.warn} ${label}: ${present ? "set" : "missing"}`);
}

function ensureProviders(cfg: UserConfig) {
  const providers = (cfg.providers ??= {} as NonNullable<UserConfig["providers"]>);
  // CRITICAL: The ??= operator preserves existing objects (including apiKey), only creates new if missing
  const openai = (providers.openai ??= { enabled: false });
  const anthropic = (providers.anthropic ??= { enabled: false });
  const gemini = (providers.gemini ??= { enabled: false });
  return { providers, openai, anthropic, gemini };
}

async function status(): Promise<void> {
  const manager = new ConfigManager(); // global by default
  const config = await manager.load();

  const openaiEnv = !!getEnvKey("OPENAI_API_KEY");
  const anthropicEnv = !!getEnvKey("ANTHROPIC_API_KEY");
  const geminiEnv = !!getEnvKey("GEMINI_API_KEY");

  const openaiCfg = !!config.providers?.openai?.apiKey;
  const anthropicCfg = !!config.providers?.anthropic?.apiKey;
  const geminiCfg = !!config.providers?.gemini?.apiKey;

  console.log(`${SYMBOLS.info} Keys status (never prints secrets)\n`);
  safeStatus("OPENAI_API_KEY (env)", openaiEnv);
  safeStatus("ANTHROPIC_API_KEY (env)", anthropicEnv);
  safeStatus("GEMINI_API_KEY (env)", geminiEnv);
  console.log("");
  safeStatus("providers.openai.apiKey (global config)", openaiCfg);
  safeStatus("providers.anthropic.apiKey (global config)", anthropicCfg);
  safeStatus("providers.gemini.apiKey (global config)", geminiCfg);
  console.log("");
  console.log(`${SYMBOLS.info} Global config file is managed by ConfigManager (default global path).`);
}

async function importEnv(): Promise<void> {
  const openai = getEnvKey("OPENAI_API_KEY");
  const anthropic = getEnvKey("ANTHROPIC_API_KEY");
  const gemini = getEnvKey("GEMINI_API_KEY");

  if (!openai && !anthropic && !gemini) {
    console.log(`${SYMBOLS.err} No keys found in environment to import.`);
    console.log(`${SYMBOLS.info} Set one or more env vars, then re-run:`);
    console.log(`  export OPENAI_API_KEY="YOUR_KEY"`);
    console.log(`  export ANTHROPIC_API_KEY="YOUR_KEY"`);
    console.log(`  export GEMINI_API_KEY="YOUR_KEY"`);
    process.exit(1);
  }

  const manager = new ConfigManager(); // global by default
  const config = await manager.load();

  const next: UserConfig = JSON.parse(JSON.stringify(config));
  const { openai: openaiProvider, anthropic: anthropicProvider, gemini: geminiProvider } = ensureProviders(next);

  // CRITICAL: Only update keys that are provided in environment. Preserve existing keys.
  if (openai) {
    openaiProvider.apiKey = openai;
    openaiProvider.enabled = true;
  }
  
  if (anthropic) {
    anthropicProvider.apiKey = anthropic;
    anthropicProvider.enabled = true;
  }

  if (gemini) {
    geminiProvider.apiKey = gemini;
    geminiProvider.enabled = true;
  }

  await manager.save(next);

  console.log(`${SYMBOLS.ok} Imported keys into global config (values not shown).`);
  safeStatus("providers.openai.apiKey", !!openaiProvider.apiKey);
  safeStatus("providers.anthropic.apiKey", !!anthropicProvider.apiKey);
  safeStatus("providers.gemini.apiKey", !!geminiProvider.apiKey);
}

async function setInteractive(): Promise<void> {
  const rl = readlinePromises.createInterface({ input, output });
  try {
    console.log(`${SYMBOLS.info} Keys: interactive set (values are hidden; not printed)\n`);
    const provider = (await rl.question("Which key do you want to set? (openai/anthropic/gemini/all): ")).trim().toLowerCase();

    if (!["openai", "anthropic", "gemini", "all"].includes(provider)) {
      console.log(`${SYMBOLS.err} Invalid choice: ${provider}`);
      process.exit(1);
    }

    const promptHidden = async (prompt: string): Promise<string> => {
      // Use classic readline so we can suppress echo in a TTY.
      const rli = readline.createInterface({ input, output });
      try {
        // Suppress echo by overriding readline's internal output hook.
        (rli as any)._writeToOutput = function _writeToOutput(_: string) {
          // no-op: prevents echoing characters
        };
        const answer = await new Promise<string>((resolve) => rli.question(prompt, resolve));
        output.write("\n");
        return (answer ?? "").trim();
      } finally {
        rli.close();
      }
    };

    const openaiKey =
      provider === "openai" || provider === "all" ? await promptHidden("Paste OPENAI_API_KEY (hidden): ") : "";

    const anthropicKey =
      provider === "anthropic" || provider === "all" ? await promptHidden("Paste ANTHROPIC_API_KEY (hidden): ") : "";

    const geminiKey =
      provider === "gemini" || provider === "all" ? await promptHidden("Paste GEMINI_API_KEY (hidden): ") : "";

    if ((provider === "openai" || provider === "all") && !openaiKey) {
      console.log(`${SYMBOLS.err} OPENAI_API_KEY was empty.`);
      process.exit(1);
    }
    if ((provider === "anthropic" || provider === "all") && !anthropicKey) {
      console.log(`${SYMBOLS.err} ANTHROPIC_API_KEY was empty.`);
      process.exit(1);
    }
    if ((provider === "gemini" || provider === "all") && !geminiKey) {
      console.log(`${SYMBOLS.err} GEMINI_API_KEY was empty.`);
      process.exit(1);
    }

    const manager = new ConfigManager(); // global by default
    const config = await manager.load();
    const next: UserConfig = JSON.parse(JSON.stringify(config));
    const { openai, anthropic, gemini } = ensureProviders(next);

    if (openaiKey) {
      openai.apiKey = openaiKey;
      openai.enabled = true;
    }
    if (anthropicKey) {
      anthropic.apiKey = anthropicKey;
      anthropic.enabled = true;
    }
    if (geminiKey) {
      gemini.apiKey = geminiKey;
      gemini.enabled = true;
    }

    await manager.save(next);

    console.log(`${SYMBOLS.ok} Saved key(s) to global config (values not shown).`);
    safeStatus("providers.openai.apiKey", !!openai.apiKey);
    safeStatus("providers.anthropic.apiKey", !!anthropic.apiKey);
    safeStatus("providers.gemini.apiKey", !!gemini.apiKey);
  } finally {
    rl.close();
  }
}

async function importClipboard(): Promise<void> {
  // macOS-only convenience: read from clipboard without pasting into files.
  // User must copy the key first; we never print the clipboard contents.
  let clip = "";
  try {
    clip = execSync("pbpaste", { encoding: "utf8" }).trim();
  } catch {
    console.log(`${SYMBOLS.err} Clipboard import requires macOS 'pbpaste' (not available).`);
    process.exit(1);
  }

  if (!clip) {
    console.log(`${SYMBOLS.err} Clipboard is empty.`);
    process.exit(1);
  }

  const rl = readlinePromises.createInterface({ input, output });
  try {
    const provider = (await rl.question("Clipboard contains a key. Save it as (openai/anthropic/gemini)? ")).trim().toLowerCase();
    if (!["openai", "anthropic", "gemini"].includes(provider)) {
      console.log(`${SYMBOLS.err} Invalid choice: ${provider}`);
      process.exit(1);
    }

    const manager = new ConfigManager();
    const config = await manager.load();
    const next: UserConfig = JSON.parse(JSON.stringify(config));
    const { openai, anthropic, gemini } = ensureProviders(next);

    if (provider === "openai") {
      openai.apiKey = clip;
      openai.enabled = true;
    } else if (provider === "anthropic") {
      anthropic.apiKey = clip;
      anthropic.enabled = true;
    } else {
      gemini.apiKey = clip;
      gemini.enabled = true;
    }

    await manager.save(next);
    console.log(`${SYMBOLS.ok} Imported clipboard key into global config (value not shown).`);
    safeStatus("providers.openai.apiKey", !!openai.apiKey);
    safeStatus("providers.anthropic.apiKey", !!anthropic.apiKey);
    safeStatus("providers.gemini.apiKey", !!gemini.apiKey);
  } finally {
    rl.close();
  }
}

function runAppleScriptLines(lines: string[]): string {
  // IMPORTANT: Use execFileSync with separate `-e` args to avoid shell-quoting issues.
  // This fixes osascript parse errors when scripts contain quotes/newlines.
  const args: string[] = [];
  for (const line of lines) {
    args.push("-e", line);
  }
  return execFileSync("osascript", args, { encoding: "utf8" }).trim();
}

async function setGui(): Promise<void> {
  if (os.platform() !== "darwin") {
    console.log(`${SYMBOLS.err} keys:set-gui is macOS-only.`);
    console.log(`${SYMBOLS.info} Use: npm run keys:set (hidden terminal input)`);
    process.exit(1);
  }

  // 1) Choose provider(s)
  // AppleScript display dialog only allows up to 3 buttons; use a list chooser instead.
  const choice = runAppleScriptLines([
    'set picked to choose from list {"OpenAI","Anthropic","Gemini","All"} with prompt "Which key do you want to set?" default items {"OpenAI"}',
    "if picked is false then return \"\"",
    "return item 1 of picked",
  ]).trim();

  if (!choice) {
    console.log(`${SYMBOLS.info} Cancelled. No keys were changed.`);
    return;
  }

  // 2) Prompt for secret(s) with hidden answer
  const promptHidden = (label: string) =>
    runAppleScriptLines([
      `set t to text returned of (display dialog "Paste ${label}:" default answer "" with hidden answer)`,
      "return t",
    ]).trim();

  const openaiKey = choice === "OpenAI" || choice === "All" ? promptHidden("OPENAI_API_KEY") : "";
  const anthropicKey = choice === "Anthropic" || choice === "All" ? promptHidden("ANTHROPIC_API_KEY") : "";
  const geminiKey = choice === "Gemini" || choice === "All" ? promptHidden("GEMINI_API_KEY") : "";

  if ((choice === "OpenAI" || choice === "All") && !openaiKey) {
    console.log(`${SYMBOLS.err} OPENAI_API_KEY was empty. Nothing saved.`);
    process.exit(1);
  }
  if ((choice === "Anthropic" || choice === "All") && !anthropicKey) {
    console.log(`${SYMBOLS.err} ANTHROPIC_API_KEY was empty. Nothing saved.`);
    process.exit(1);
  }
  if ((choice === "Gemini" || choice === "All") && !geminiKey) {
    console.log(`${SYMBOLS.err} GEMINI_API_KEY was empty. Nothing saved.`);
    process.exit(1);
  }

  const manager = new ConfigManager(); // global by default
  const config = await manager.load();
  const next: UserConfig = JSON.parse(JSON.stringify(config));
  const { openai, anthropic, gemini } = ensureProviders(next);

  if (openaiKey) {
    openai.apiKey = openaiKey;
    openai.enabled = true;
  }
  if (anthropicKey) {
    anthropic.apiKey = anthropicKey;
    anthropic.enabled = true;
  }
  if (geminiKey) {
    gemini.apiKey = geminiKey;
    gemini.enabled = true;
  }

  await manager.save(next);

  console.log(`${SYMBOLS.ok} Saved key(s) to global config (values not shown).`);
  safeStatus("providers.openai.apiKey", !!openai.apiKey);
  safeStatus("providers.anthropic.apiKey", !!anthropic.apiKey);
  safeStatus("providers.gemini.apiKey", !!gemini.apiKey);
}

async function main() {
  const cmd = process.argv[2] || "status";

  if (cmd === "status") return status();
  if (cmd === "import-env") return importEnv();
  if (cmd === "set") return setInteractive();
  if (cmd === "import-clipboard") return importClipboard();
  if (cmd === "set-gui") return setGui();

  console.log(`${SYMBOLS.err} Unknown command: ${cmd}`);
  console.log(`Usage: tsx packages/cli/keys-manager.ts <status|import-env|set|import-clipboard|set-gui>`);
  process.exit(1);
}

main().catch((err) => {
  console.error(`${SYMBOLS.err} Keys manager failed:`, err);
  process.exit(1);
});



