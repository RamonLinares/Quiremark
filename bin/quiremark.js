#!/usr/bin/env node
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

function printHelp() {
  console.log(`Usage:
  quiremark publish --site-root .

Commands:
  publish            Compile a static site from <site-root>/content to <site-root>/out.

Options:
  --site-root <dir>  External site root. Defaults to the current directory.
  --json             Print the publish result as JSON.
  --help             Show this help text.`);
}

function readOption(args, name, fallback = '') {
  const equalsPrefix = `${name}=`;
  const equalsArg = args.find(arg => arg.startsWith(equalsPrefix));
  if (equalsArg) return equalsArg.slice(equalsPrefix.length);
  const index = args.indexOf(name);
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) {
    return args[index + 1];
  }
  return fallback;
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(command ? 0 : 1);
}

if (command !== 'publish') {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

const siteRoot = path.resolve(readOption(args, '--site-root', process.cwd()));
const outputJson = args.includes('--json');

process.env.QUIREMARK_DATA_DIR = process.env.QUIREMARK_DATA_DIR || siteRoot;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { publishSite } = await import(pathToFileURL(path.join(__dirname, '..', 'server.js')).href);
const publishLog = [];
const result = await publishSite({
  siteRoot,
  log: publishLog,
  logMsg: msg => publishLog.push(`[SSG] ${msg}`)
});

if (outputJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  result.log.forEach(line => console.log(line));
  if (result.success) {
    console.log(`Published static site to ${result.outDir}`);
  }
}

if (!result.success) {
  if (!outputJson) console.error(result.error || 'Publish failed.');
  process.exit(1);
}
