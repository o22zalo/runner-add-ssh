const { program } = require("commander");
const path = require("path");
const packageJson = require("../../package.json");

// Commands
const setupCommand = require("./commands/setup");

program
  .name("runner-add-ssh")
  .description(packageJson.description)
  .version(packageJson.version, "-v, --version", "Output the current version");

// All options in one place
program
  .option("--cwd <path>", "Working directory for .runner-data", process.cwd())
  .option("--verbose", "Enable verbose logging", false)
  .option("--quiet", "Suppress output (errors only)", false)
  .option(
    "--public-key <key>",
    "SSH public key (overrides SSH_RUNNER_PUBLIC_KEY)",
  )
  .option("--port <number>", "SSH port (overrides SSH_PORT)", parseInt)
  .option("--mode <mode>", "SSH mode: root, user, auto (overrides SSH_MODE)")
  .option("--allow-users <users>", "Allowed users (overrides SSH_ALLOW_USERS)")
  .option(
    "--default-cwd <path>",
    "Default working directory (overrides SSH_DEFAULT_CWD)",
  )
  .option(
    "--disable-force-cwd",
    "Disable ForceCommand (overrides SSH_DISABLE_FORCE_CWD)",
  )
  .action((options) => {
    // Pass all options directly to setupCommand
    setupCommand(options);
  });

// Parse arguments
program.parse(process.argv);
