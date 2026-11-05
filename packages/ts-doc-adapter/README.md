# TSDoc Adapter

Converts TSDoc extraction artifacts to HIA core documents.

The P1 adapter emits runtime symbols into HIA core documents and keeps type-only symbols in document metadata.

## Project extraction compatibility

The unreleased `hia-tsdoc-extraction@0.2.0-draft` project format presents actual types and members as HIA symbols, retaining public entry metadata and declaration parent relationships. The original `0.1.0-draft` format keeps runtime symbols visible and type-only declarations in metadata. Input versions are checked explicitly; changing an old artifact's version does not migrate it. The adapter creates no source fetch permission or JavaScript emission proof.
