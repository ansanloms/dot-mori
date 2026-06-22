# dot-mori

dotfiles を管理・インストールするための CLI ツール。設定ファイル (YAML) に従い、指定先へシンボリックリンクを作成・削除する。

## 構成

- `cli.ts` — エントリポイント。[gunshi](https://jsr.io/@gunshi/gunshi) でコマンドライン引数を処理し、`mod.ts` のロジックを呼び出す。
- `mod.ts` — 中核ロジック。設定の読み込みと検証、パス展開、リンクの作成・削除。
- `mod.test.ts` — `mod.ts` の単体テスト。
- `deps/` — 外部依存の集約ディレクトリ。

## 開発ワークフロー

タスクは `deno.json` の `tasks` に定義している。

| コマンド                             | 用途                                                     |
| ------------------------------------ | -------------------------------------------------------- |
| `deno task dot-mori --config <path>` | ツールを実行する。`--clean` を付けるとリンクを削除する。 |
| `deno task test`                     | テストを実行する。                                       |
| `deno task check`                    | 型チェックを実行する。                                   |
| `deno task lint`                     | `deno lint` と `deno fmt --check` を実行する。           |
| `deno task fix`                      | `deno lint --fix` と `deno fmt` を実行する。             |

コミット前に `deno task check`・`deno task lint`・`deno task test` を通すこと。

## 規約

### 依存の集約

外部ライブラリは直接 import せず、`deps/<scope>/<package>/mod.ts` で再エクスポートしてから各モジュールで利用する。バージョンの更新はこのラッパファイルのみを書き換えること。

例: `deps/@std/path/mod.ts` が `jsr:@std/path@x.y.z` を再エクスポートし、利用側は `./deps/@std/path/mod.ts` を import する。

### テスト

- テストコードは対象と同階層に `*.test.ts` で置く。
- ファイル I/O を伴う処理は `Deno.makeTempDir()` を使い、`finally` で後始末する。
- env に依存する処理は値を引数で注入できるようにしてテストする (例: `expand` の `homedir` 引数)。

### 実行権限

`dot-mori` タスクの権限は以下の方針で付与する。

- `--allow-env=HOME,USERPROFILE` — home ディレクトリ解決 (`deps/dir`) が読む env 変数のみに限定する。
- `--allow-read` / `--allow-write` — 対象パスは設定次第で任意の場所を指す為、静的に絞れない。限定すると正当な設定が動作しなくなる為、対象を限定せず据え置く。
