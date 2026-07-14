# Target Project Example

This example models how a normal TypeScript project can consume `@hia-doc/tsdoc-runner` without being part of the `hia-tsdoc` workspace.

Run the packaged consumer smoke from the repository root:

```sh
npm run check:target-consumer
```

The smoke test packs all local workspace packages, installs those tarballs into a temporary consumer project, and runs:

```sh
hia-tsdoc --config tsdoc.config.json
```

The example keeps `sourcesContentPolicy` set to `none` so release checks can verify that source content is not embedded by default.

