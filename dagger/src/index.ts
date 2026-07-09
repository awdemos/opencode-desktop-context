import { dag, func, object } from "@dagger.io/dagger"

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
      .from("oven/bun:latest")
      .withDirectory("/src", source)
      .withWorkdir("/src")
      .withExec(["bun", "install"])
      .withExec(["bun", "test"])
      .withExec(["bun", "run", "build"])

    return await node.stdout()
  }

  /**
   * List the files available in the module source directory for debugging.
   */
  @func()
  async debugFiles(): Promise<string> {
    const source = projectSource()
    const node = dag.container()
      .from("oven/bun:latest")
      .withDirectory("/src", source)
      .withWorkdir("/src")
      .withExec(["find", ".", "-type", "f", "-not", "-path", "./node_modules/*", "-not", "-path", "./dist/*", "-not", "-path", "./dagger/*"])
    return await node.stdout()
  }

  /**
   * Publish the package to npm using the provided token.
   * Creates the release build automatically before publishing.
   */
  @func()
  async publish(token: string): Promise<string> {
    const source = projectSource()
    const node = dag.container()
      .from("oven/bun:latest")
      .withExec(["sh", "-c", "if command -v apk; then apk add --no-cache npm; else apt-get update && apt-get install -y npm; fi"])
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
