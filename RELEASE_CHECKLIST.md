# Release Checklist

- Run `npm run release:gate`.
- Confirm `npm pack --dry-run --json` output.
- Confirm `npm run check:target-consumer` installs local package tarballs into a temporary consumer and runs the packaged `hia-tsdoc` binary.
- Confirm generated fixture output has no local paths or embedded source content.
- Confirm no tarballs are committed.
- Confirm dependency and license review is up to date.
