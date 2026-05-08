import { spawn } from "node:child_process"
import path from "node:path"

const root = process.cwd()

function runStep(label, command, args, cwd = root) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let output = `\n=== ${label} ===\n`
    child.stdout.on("data", (chunk) => {
      output += chunk.toString()
      process.stdout.write(chunk)
    })
    child.stderr.on("data", (chunk) => {
      output += chunk.toString()
      process.stderr.write(chunk)
    })
    child.on("close", (code) => {
      resolve({
        label,
        code: code ?? 1,
        output: `${output}\n[exitCode=${code ?? 1}]\n`,
      })
    })
  })
}

const frontend = await runStep("frontend-unit", "npm", ["run", "test:unit"])

const backendDir = path.join(root, "backend")
const backendCommand = process.platform === "win32" ? "cmd.exe" : "./mvnw"
const backendArgs = process.platform === "win32" ? ["/c", "mvnw.cmd", "-q", "test"] : ["-q", "test"]
const backend = await runStep("backend-unit", backendCommand, backendArgs, backendDir)

const hasFailure = frontend.code !== 0 || backend.code !== 0
if (hasFailure) {
  process.exitCode = 1
}
