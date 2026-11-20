# Contributing

Follow the RaceHubOS contributor rules and add-on contract:

- One coherent change per commit, using `type: description` without a scope.
- Keep changes inside this add-on. Wrap core modules with `@base`, preserve exports
  and props, and never copy their implementations or change core schema/migrations.
- Keep every UI key in English, French and German; prefix events with `cu-usb:`.
- Run `npm run format`, `npm run lint`, `npm test` and the Playwright UI tests.
- Prove a regression test fails when the protected rule is deliberately broken.
- Run the host checks and tests described in README.md. Backend database tests
  must use `npm test -w @racehubos/backend`, never a live race database.
- Leave core versions and changelogs to the maintainer. Change lockfiles only when
  changing dependencies. A new add-on release updates its manifest and uses a tag.

See the upstream [contributor guide](https://github.com/AnselmeSDR/RaceHubOS/blob/main/CONTRIBUTING.md),
[conventions](https://github.com/AnselmeSDR/RaceHubOS/blob/main/docs/CONVENTIONS.md)
and [add-on contract](https://github.com/AnselmeSDR/RaceHubOS/blob/main/docs/ADDONS.md).
