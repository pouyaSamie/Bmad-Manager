import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const bundledDocker = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Programs",
  "DockerDesktop",
  "resources",
  "bin",
  "docker.exe",
);
const executable =
  process.platform === "win32" && fs.existsSync(bundledDocker)
    ? bundledDocker
    : "docker";
const env = {
  ...process.env,
  PATH: path.dirname(executable) + path.delimiter + process.env.PATH,
};
const docker = (args) =>
  execFileSync(executable, args, {
    encoding: "utf8",
    env,
    timeout: 30000,
  }).trim();
for (const [service, port] of [
  ["codex-bridge", 3006],
  ["agy-bridge", 3005],
]) {
  const id = docker(["compose", "--profile", "cli", "ps", "-q", service]);
  assert.ok(id, `Start ${service} before running the container checks.`);
  const [container] = JSON.parse(docker(["inspect", id]));
  assert.equal(container.Config.User, "node");
  assert.equal(container.HostConfig.ReadonlyRootfs, true);
  assert.deepEqual(container.HostConfig.CapDrop, ["ALL"]);
  assert.ok(
    container.HostConfig.SecurityOpt.includes("no-new-privileges:true"),
  );
  assert.equal(Object.keys(container.HostConfig.PortBindings ?? {}).length, 0);
  assert.ok(
    container.Mounts.every((m) =>
      ["/home/node", "/run/secrets/bridge_token", "/tmp"].includes(
        m.Destination,
      ),
    ),
  );
  const code = `
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const token = fs.readFileSync('/run/secrets/bridge_token', 'utf8').trim();
    (async () => {
      assert.equal(process.getuid(), 1000);
      assert.equal(fs.existsSync('/workspace'), false);
      for (const file of ['/app/.env', '/app/.env.bridge.local', '/app/.secrets']) assert.equal(fs.existsSync(file), false);
      assert.throws(() => fs.writeFileSync('/app/bridge-verification-write', 'test'), e => ['EROFS','EACCES'].includes(e.code));
      const url = 'http://127.0.0.1:${port}/healthz';
      const get = headers => fetch(url, { headers, signal: AbortSignal.timeout(5000) });
      assert.equal((await get({})).status, 401);
      assert.equal((await get({ authorization: 'Bearer incorrect' })).status, 401);
      assert.equal((await get({ authorization: 'Bearer ' + token, origin: 'http://localhost:3002' })).status, 403);
      const response = await get({ authorization: 'Bearer ' + token });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, 'ok');
      if (${port} === 3005) {
        const settings = JSON.parse(fs.readFileSync('/home/node/.gemini/antigravity-cli/settings.json', 'utf8'));
        for (const rule of ['read_file(*)','write_file(*)','command(*)','unsandboxed(*)','mcp(*)','read_url(*)','execute_url(*)']) assert.ok(settings.permissions.deny.includes(rule));
      }
      console.log('Authenticated liveness, request rejection, profile restrictions and filesystem isolation passed.');
    })().catch(() => { console.error('Container safety verification failed.'); process.exitCode = 1; });
  `;
  console.log(`${service}: ${docker(["exec", id, "node", "-e", code])}`);
}
console.log("Container checks do not verify account login or model inference.");
