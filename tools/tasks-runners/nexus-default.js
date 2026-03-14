const { defaultTasksRunner } = require('nx/src/tasks-runner/default-tasks-runner');
const setupRemoteCache = require('../cache/nexus-remote.js');

module.exports = function nexusTasksRunner(tasks, options, context) {
  if (options.remoteCacheOptions !== false) {
    const remoteCacheOptions = options.remoteCacheOptions || {};
    options.remoteCache = setupRemoteCache(remoteCacheOptions);
  }
  return defaultTasksRunner(tasks, options, context);
};
