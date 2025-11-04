# dot-mori

A tool for managing and installing dotfiles.

## Installation

### dotfiles repository

Prepare `deno.json` and `config.yaml` as follows.

```json:deno.json
{
  "imports": {
    "dot-mori/": "https://cdn.jsdelivr.net/gh/ansanloms/dot-mori@v0.1.4/"
  },
  "tasks": {
    "dot-mori": "echo \"import 'dot-mori/cli.ts'\" | deno run -A -",
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
deno install -grfAn dot-mori https://cdn.jsdelivr.net/gh/ansanloms/dot-mori@v0.1.4/cli.ts

## install
dot-mori --config ./config.yaml

## uninstall
dot-mori --config ./config.yaml --clean
```
