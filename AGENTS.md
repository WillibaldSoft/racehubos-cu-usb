# RaceHubOS add-on instructions

Read and follow the upstream add-on contract before changing this repository:
https://github.com/AnselmeSDR/RaceHubOS/blob/main/docs/ADDONS.md

Also follow CONTRIBUTING.md here. Keep this add-on independent of the core; wrap
existing modules through @base, preserve exports and props, and keep translations
in English, French and German. Never modify core database schema or migrations.
