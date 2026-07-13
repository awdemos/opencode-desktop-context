import { dag, func, object } from "@dagger.io/dagger"

const BUN_IMAGE = "oven/bun:1.3-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0"
const NPM_VERSION = "10.9.2"

function projectSource() {
  return dag.currentModule().source().directory("..")
}

@object()
export class OpencodeDesktopContext {
  /**
   * Run the full CI pipeline: install dependencies, run tests, and build.
   */
  @func()
  async ci(): Promise<string> {
    const source = projectSource()
    const node = dag.container()
      .from(BUN_IMAGE)
      .withDirectory("/src", source)
      .withWorkdir("/src")
      .withExec(["bun", "install"])
      .withExec(["bun", "test"])
      .withExec(["bun", "run", "build"])

    return await node.stdout()
  }

  /**
   * Run security checks: audit dependencies and typecheck.
   */
  @func()
  async security(): Promise<string> {
    const source = projectSource()
    const node = dag.container()
      .from(BUN_IMAGE)
      .withDirectory("/src", source)
      .withWorkdir("/src")
      .withExec(["bun", "install"])
      .withExec(["bun", "audit"])
      .withExec(["bun", "run", "typecheck"])

    return await node.stdout()
  }

  /**
   * List the files available in the module source directory for debugging.
   */
  @func()
  async debugFiles(): Promise<string> {
    const source = projectSource()
    const node = dag.container()
      .from(BUN_IMAGE)
      .withDirectory("/src", source)
      .withWorkdir("/src")
      .withExec(["find", ".", "-type", "f", "-not", "-path", "./node_modules/*", "-not", "-path", "./dist/*", "-not", "-path", "./dagger/*"])
    return await node.stdout()
  }

  /**
   * Publish the package to npm using the NPM_TOKEN environment variable.
   * Creates the release build automatically before publishing.
   */
  @func()
  async publish(): Promise<string> {
    const token = process.env.NPM_TOKEN
    if (!token) {
      throw new Error("NPM_TOKEN environment variable is required")
    }
    const source = projectSource()
    const node = dag.container()
      .from(BUN_IMAGE)
      .withExec(["sh", "-c", `apk add --no-cache npm && npm install -g npm@${NPM_VERSION}`])
      .withDirectory("/src", source)
      .withWorkdir("/src")
      .withExec(["bun", "install"])
      .withExec(["bun", "test"])
      .withExec(["bun", "run", "build"])
      .withSecretVariable("NPM_TOKEN", dag.setSecret("NPM_TOKEN", token))
      .withExec([
        "sh",
        "-c",
        'printf "//registry.npmjs.org/:_authToken=%s\n" "$NPM_TOKEN" > ~/.npmrc && npm publish --access public',
      ])

    return await node.stdout()
  }
}
