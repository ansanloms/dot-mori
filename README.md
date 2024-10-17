# dot-mori

A tool for managing and installing dotfiles.

## Installation

Prepare `deno.json` and `config.yaml` as follows.

### `deno.json`

```json
{
  "imports": {
    "dot-mori/": "https://raw.githubusercontent.com/ansanloms/dot-mori/v0.1.2/"
  },
  "tasks": {
    "dot-mori": "echo \"import 'dot-mori/cli.ts'\" | deno run -A -",
    "install": "deno task dot-mori --config ./config.yaml",
    "uninstall": "deno task dot-mori --config ./config.yaml --clean"
  }
}
```

### `config.yaml`

```yaml
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

## Usage

### Installation

Run the following command to link the specified dotfiles.

```bash
deno task install
```

### Uninstallation

To unlink, run the following command.

```bash
deno task uninstall
```
