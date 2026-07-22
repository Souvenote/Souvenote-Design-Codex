import { spawn } from 'node:child_process';
import net from 'node:net';
import process from 'node:process';
import {
  composeArguments,
  createSafeLocalEnvironment,
  localPorts,
  readinessTargets,
  repositoryRoot,
  workspaceEnvironment,
} from './lib/local-runtime.mjs';
import { waitForReadiness } from './lib/health.mjs';

const smokeMode = process.argv.slice(2).includes('--smoke');
const ownedChildren = [];
const environment = createSafeLocalEnvironment();
let cleanupStarted = false;
let composeStarted = false;
let earlyExitReason;
let stopSignal;

const runCommand = (command, arguments_, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: environment,
      shell: false,
      stdio: options.stdio ?? 'ignore',
      windowsHide: true,
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with ${signal ? `signal ${signal}` : `code ${String(code)}`}.`));
    });
  });

const assertPortAvailable = (name, port) =>
  new Promise((resolve, reject) => {
    const server = net.createServer();

    server.unref();
    server.once('error', (error) => {
      reject(
        new Error(
          `${name} cannot start because 127.0.0.1:${port} is already in use (${error.code ?? 'unknown error'}).`,
        ),
      );
    });
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

const preflight = async () => {
  const portChecks = Object.entries(localPorts).map(([name, port]) => assertPortAvailable(name, port));
  await Promise.all(portChecks);

  try {
    await runCommand('docker', ['info', '--format', '{{.ServerVersion}}']);
  } catch {
    throw new Error('Docker is unavailable. Start Docker Desktop (or the Docker daemon) and retry.');
  }

  await runCommand('docker', composeArguments('version'));
  await runCommand('docker', composeArguments('config', '--quiet'));
};

const startWorkspace = (name, workspace) => {
  const npmExecPath = environment.npm_execpath;
  const command = process.platform === 'win32' ? process.execPath : 'npm';
  const commandArguments =
    process.platform === 'win32'
      ? [npmExecPath, 'run', 'dev', '--workspace', workspace]
      : ['run', 'dev', '--workspace', workspace];

  if (process.platform === 'win32' && !npmExecPath) {
    throw new Error('npm_execpath is unavailable. Start the stack through the root npm script.');
  }

  const child = spawn(command, commandArguments, {
    cwd: repositoryRoot,
    detached: process.platform !== 'win32',
    env: workspaceEnvironment(workspace, environment),
    shell: false,
    stdio: 'inherit',
    windowsHide: true,
  });

  ownedChildren.push({ child, name });
  child.once('error', (error) => {
    if (!cleanupStarted) {
      earlyExitReason = `${name} failed to start: ${error.message}`;
    }
  });
  child.once('exit', (code, signal) => {
    if (!cleanupStarted) {
      earlyExitReason = `${name} stopped unexpectedly (${signal ?? `code ${String(code)}`}).`;
    }
  });
};

const terminateWindowsTree = async (processId) => {
  try {
    await runCommand('taskkill', ['/pid', String(processId), '/t', '/f'], { stdio: 'ignore' });
  } catch {
    // The process may already have exited. Never target any PID except a child we spawned.
  }
};

const terminateOwnedChild = async ({ child }) => {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    await terminateWindowsTree(child.pid);
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    return;
  }

  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 5_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // The child process tree exited between the state check and signal.
    }
  }
};

const cleanup = async () => {
  if (cleanupStarted) {
    return;
  }
  cleanupStarted = true;

  await Promise.all(ownedChildren.map(terminateOwnedChild));

  if (composeStarted) {
    try {
      // `down` removes the owned containers/network but deliberately omits `--volumes`.
      await runCommand('docker', composeArguments('down', '--remove-orphans'), { stdio: 'inherit' });
    } catch (error) {
      console.error(`Could not stop the local Compose project: ${error.message}`);
    }
  }
};

const waitForStop = async () => {
  while (!stopSignal && !earlyExitReason) {
    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  if (earlyExitReason) {
    throw new Error(earlyExitReason);
  }
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stopSignal = signal;
  });
}

const main = async () => {
  try {
    console.log('Checking local ports and Docker...');
    await preflight();

    console.log('Starting the project-scoped PostgreSQL 16 container...');
    if (stopSignal) {
      return;
    }
    // Compose may create a container before `--wait` reports a failure, so cleanup
    // owns this project from the moment the mutating command begins.
    composeStarted = true;
    await runCommand('docker', composeArguments('up', '--detach', '--wait', 'postgres'), { stdio: 'inherit' });

    if (stopSignal) {
      return;
    }

    startWorkspace('web', '@souvenote/web');
    startWorkspace('api', '@souvenote/api');
    startWorkspace('worker', '@souvenote/worker');

    console.log('Waiting for web, API, worker, and database readiness...');
    await waitForReadiness({
      abortReason: () => earlyExitReason ?? stopSignal,
    });

    console.log('Local stack is ready:');
    for (const target of readinessTargets) {
      console.log(`  ${target.name}: ${target.url}`);
    }

    if (!smokeMode) {
      console.log('Press Ctrl+C to stop owned processes and preserve local data.');
      await waitForStop();
    }
  } finally {
    await cleanup();
  }
};

void main().catch((error) => {
  if (stopSignal) {
    return;
  }
  console.error(error instanceof Error ? error.message : 'Local stack failed.');
  process.exitCode = 1;
});
