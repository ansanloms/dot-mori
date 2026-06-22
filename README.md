# dot-mori

A tool for managing and installing dotfiles.

## Installation

### dotfiles repository

Prepare `deno.json` and `config.yaml` as follows.

```json:deno.json
{
  "imports": {
    "dot-mori/": "https://cdn.jsdelivr.net/gh/ansanloms/dot-mori@0.1.6/"
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
deno install -grfn dot-mori --allow-env=NODE_*,HOME,USERPROFILE --allow-read --allow-write https://cdn.jsdelivr.net/gh/ansanloms/dot-mori@0.1.6/cli.ts

## install
dot-mori --config ./config.yaml

## uninstall
dot-mori --config ./config.yaml --clean
```
