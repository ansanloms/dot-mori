import dir from "./deps/dir/mod.ts";
import * as fs from "./deps/@std/fs/mod.ts";
import * as path from "./deps/@std/path/mod.ts";
import * as yaml from "./deps/@std/yaml/mod.ts";

import { FromSchema } from "./deps/json-schema-to-ts/mod.ts";
import { type Schema, Validator } from "./deps/@cfworker/json-schema/mod.ts";

const SchemaConfig = {
  type: "object",
  description: "Config.",
  required: ["link"],
  properties: {
    link: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: {
          "$ref": "#/definitions/Link",
        },
      },
    },
    permissions: {
      type: "array",
      items: {
        "$ref": "#/definitions/Permission",
      },
      description: "file/directory permissions to apply after linking.",
    },
  },
  additionalProperties: false,
  definitions: {
    Link: {
      type: "object",
      description: "Link.",
      required: ["src"],
      properties: {
        src: {
          type: "string",
          description: "src file path.",
        },
        targets: {
          type: "array",
          items: {
            "$ref": "#/definitions/EnumOs",
          },
          description: "target os.",
        },
      },
      additionalProperties: false,
    },
    EnumOs: {
      type: "string",
      description: "Supported target operating systems.",
      enum: ["darwin", "linux", "windows"],
    },
    Permission: {
      type: "object",
      description: "Permission.",
      required: ["path", "mode"],
      properties: {
        path: {
          type: "string",
          description: "target file/directory path (supports glob).",
        },
        mode: {
          type: "string",
          description: 'octal permission mode string (e.g. "700").',
          pattern: "^[0-7]{3,4}$",
        },
        targets: {
          type: "array",
          items: {
            "$ref": "#/definitions/EnumOs",
          },
          description: "target os.",
        },
      },
      additionalProperties: false,
    },
  },
} as const;

export type Config = FromSchema<typeof SchemaConfig>;

// SchemaConfig は `as const` で readonly 型に推論される為、可変配列を期待する Schema 型へキャストする。
// draft は SchemaConfig の記法 (definitions) に合わせ "7" を指定し、shortCircuit を false にして
// 最初のエラーで止めず全件を収集する。
const validator = new Validator(SchemaConfig as unknown as Schema, "7", false);

export function assertConfig(x: unknown): asserts x is Config {
  const { valid, errors } = validator.validate(x);
  if (!valid) {
    throw new Error(errors.map((error) => error.error).join("; "));
  }
}

/**
 * YAML 文字列をパースし、Config として検証して返す。
 * ファイル I/O を含まない純粋関数。
 */
export const parseConfig = (text: string): Config => {
  const config = yaml.parse(text);
  assertConfig(config);

  return config;
};

/**
 * 設定ファイルを読み込み、Config として検証して返す。
 */
export const getConfig = async (configPath: string): Promise<Config> => {
  return parseConfig(await Deno.readTextFile(configPath));
};

/**
 * home ディレクトリを解決する。
 * env (HOME / USERPROFILE) に依存する為、呼び出し時に評価する。
 */
export const getHomedir = (): string | undefined => dir("home") ?? undefined;

/**
 * 現在の OS で chmod (パーミッション変更) がサポートされているか判定する。
 * `Deno.chmod` は Windows では使用できない為、windows なら false を返す。
 * `os` を注入できる為、実行環境に依存せずテスト可能。
 */
export const isChmodSupported = (
  os: typeof Deno.build.os = Deno.build.os,
): boolean => os !== "windows";

/**
 * パスを展開する。先頭の `~` を home ディレクトリへ、相対パスを絶対パスへ変換する。
 * `homedir` を注入できる為、env に依存せずテスト可能。
 */
export const expand = (
  filepath: string,
  homedir: string | undefined = getHomedir(),
): string => {
  if (filepath[0] === "~") {
    if (!homedir) {
      throw new Error("Cannot find home directory.");
    }

    filepath = path.join(homedir, filepath.slice(1));
  }
  filepath = path.normalize(filepath);

  if (!path.isAbsolute(filepath)) {
    filepath = path.join(Deno.cwd(), filepath);
  }

  return filepath;
};

export const clean = async (dest: string) => {
  const expandDest = expand(dest);

  if (!(await fs.exists(expandDest))) {
    return;
  }

  if ((await Deno.readLink(expandDest).catch(() => null)) === null) {
    throw new Error("'" + dest + "' already exists.");
  }

  await Deno.remove(expandDest);
};

export const link = async (dest: string, src: string) => {
  const expandSrc = expand(src);
  const expandDest = expand(dest);

  if (!(await fs.exists(expandSrc))) {
    throw new Error(`'${src}' not exists.`);
  }

  await Deno.mkdir(path.dirname(expandDest), { recursive: true });
  await Deno.symlink(expandSrc, expandDest, {
    type: (await Deno.stat(expandSrc)).isDirectory ? "dir" : "file",
  });
};

/**
 * glob パターンにマッチする全ファイル・ディレクトリへ mode (8 進数文字列) の chmod を適用する。
 * パスは `expand()` で解決する為、`~` 展開と cwd 基準の相対パス解決に対応する。
 * マッチが 0 件の場合は chmod を行わず空配列を返す (呼び出し側で skipped として扱う想定)。
 * mode の妥当性検証は config の schema (pattern) に委ね、ここでは再検証しない。
 */
export const applyPermission = async (
  targetPath: string,
  mode: string,
): Promise<string[]> => {
  const expandTarget = expand(targetPath);

  const matches: string[] = [];
  for await (
    const entry of fs.expandGlob(expandTarget, {
      includeDirs: true,
      followSymlinks: false,
    })
  ) {
    matches.push(entry.path);
  }

  for (const match of matches) {
    await Deno.chmod(match, parseInt(mode, 8));
  }

  return matches;
};
