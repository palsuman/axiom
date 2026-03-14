const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function resolveRemoteDir(options = {}) {
  const envKey = options.remoteDirEnv || 'NEXUS_REMOTE_CACHE_DIR';
  const configuredDir = process.env[envKey] || options.remoteDir;
  const defaultDir = options.defaultRemoteDir || path.join(os.homedir(), '.nexus', 'cache');
  return path.resolve(configuredDir || defaultDir);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function copyDir(source, destination) {
  await fs.promises.rm(destination, { recursive: true, force: true });
  ensureDir(path.dirname(destination));
  await fs.promises.cp(source, destination, { recursive: true });
}

async function copyIfExists(source, destination) {
  try {
    await copyDir(source, destination);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

module.exports = function setup(options = {}) {
  const remoteDir = resolveRemoteDir(options);
  ensureDir(remoteDir);
  return {
    name: 'nexus-remote-cache',
    async retrieve(hash, cacheDirectory) {
      const remotePath = path.join(remoteDir, hash);
      const localPath = path.join(cacheDirectory, hash);
      const restored = await copyIfExists(remotePath, localPath);
      if (restored) {
        process.stdout.write(`[nexus-cache] restored ${hash} from ${remoteDir}\n`);
      }
      return restored;
    },
    async store(hash, cacheDirectory) {
      const remotePath = path.join(remoteDir, hash);
      const localPath = path.join(cacheDirectory, hash);
      try {
        await copyIfExists(localPath, remotePath);
        process.stdout.write(`[nexus-cache] stored ${hash} to ${remoteDir}\n`);
        return true;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return false;
        }
        throw error;
      }
    },
    resolveRemoteDir
  };
};

module.exports.resolveRemoteDir = resolveRemoteDir;
