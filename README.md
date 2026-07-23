# dot-mori

A tool for managing and installing dotfiles.

## Installation

### dotfiles repository

Prepare `deno.json` and `config.yaml` as follows.

```json:deno.json
{
  "imports": {
    "dot-mori/": "https://cdn.jsdelivr.net/gh/ansanloms/dot-mori@0.2.0/"
  },
  "tasks": {
    "dot-mori": {
      "description": "Manage and install dotfiles.",
      "command": "deno run --allow-env=NODE_*,HOME,USERPROFILE --allow-read --allow-write dot-mori/cli.ts"
    },
    "install": "deno task dot-mori --config ./config.yaml",
    "uninstall": "deno task dot-mori --config ./config.yaml --clean"
  }
}
```

```yaml:config.yaml
link:
  ~/.bashrc:
    - src: ./path/to/.bashrc
  ~/.gitconfig:
    - src: ./path/to/.gitconfig
  ~/.gitconfig.os:
    - src: ./path/to/.gitconfig.windows
      targets:
        - windows
    - src: ./path/to/.gitconfig.linux
      targets:
        - linux
```

Optionally, add a `permissions` section to apply file modes (`chmod`) to the
linked files after linking. This is useful for files such as SSH private keys
that require restrictive permissions (e.g. `600`), since git only tracks the
executable bit and other permissions fall back to the umask on
clone/checkout.

```yaml:config.yaml
permissions:
  - path: ./.ssh
    mode: "700"
  - path: ./.ssh/keys/*
    mode: "600"
  - path: ./.ssh/keys/*.pub
    mode: "644"
    targets:
      - linux
```

- `permissions` applies file modes to the matched paths after linking (not
  executed with `--clean`).
- `path` supports `~` expansion, cwd-relative resolution (same as `src`), and
  glob patterns; matches both files and directories.
- Rules are applied in order, so later rules override earlier ones (write
  broad globs first, narrower ones later).
- `mode` is an octal string like `"600"`.
- `targets` optionally limits a rule to specific operating systems (same as
  `link`).
- Rules matching no path are reported as skipped, not failed.
- On Windows, all permission rules are skipped (chmod is not supported).
- `path` is expected to point at the real files in the dotfiles repository
  (the `src` side); `Deno.chmod` follows symlinks.

Run the following command to link the specified dotfiles.

```bash
deno task install
```

To unlink, run the following command.

```bash
deno task uninstall
```

### command

```bash
deno install -grfn dot-mori --allow-env=NODE_*,HOME,USERPROFILE --allow-read --allow-write https://cdn.jsdelivr.net/gh/ansanloms/dot-mori@0.2.0/cli.ts

## install
dot-mori --config ./config.yaml

## uninstall
dot-mori --config ./config.yaml --clean
```
