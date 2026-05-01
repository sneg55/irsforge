#!/usr/bin/env bash
# Thin wrapper around `daml` that filters the "outdated version of the Daml
# assistant" warning the 2.10.x assistant prints on every invocation.
#
# The warning advertises Daml 3.x, which is a non-backwards-compatible rewrite
# we can't adopt without migrating off Daml Finance v4 and Canton 2.x.
# `update-check: never` in `~/.daml/daml-config.yaml` does NOT silence this
# particular warning (it only gates the periodic remote version check), and
# there's no env-var knob for it in the 2.10.4 assistant, so we strip the
# three-line block from stderr. Real errors and every other warning pass
# through untouched.
#
# Usage: scripts/daml-quiet.sh <any daml subcommand and args>
set -euo pipefail

# Bootstrap PATH and JAVA_HOME so Makefile targets work in non-interactive
# shells (CI, fresh terminals without fish/bash rc). Single source of truth
# is scripts/lib/daml-env.sh — see that file for IRSFORGE_DAML_HOME /
# IRSFORGE_JAVA_HOME overrides.
# shellcheck source=lib/daml-env.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/daml-env.sh"

exec daml "$@" 2> >(
  grep -v -E \
    '^(WARNING: Using an outdated version of the Daml assistant\.|Please upgrade to the latest stable version by running:|[[:space:]]+daml install latest)$' \
    >&2
)
