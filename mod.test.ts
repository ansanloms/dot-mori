import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "./deps/@std/assert/mod.ts";
import * as path from "./deps/@std/path/mod.ts";

import {
  applyPermission,
  clean,
  expand,
  isChmodSupported,
  link,
  parseConfig,
} from "./mod.ts";

/** シンボリックリンク自体の存在を確認する (リンク先を辿らない)。 */
const lexists = async (p: string): Promise<boolean> => {
  try {
    await Deno.lstat(p);
    return true;
  } catch {
    return false;
  }
};

// --- expand ---

Deno.test("expand: 先頭の ~ を home ディレクトリへ展開する", () => {
  assertEquals(
    expand("~/foo/bar", "/tmp/home"),
    path.join("/tmp/home", "foo", "bar"),
  );
});

Deno.test("expand: ~ 単体を home ディレクトリへ展開する", () => {
  assertEquals(expand("~", "/tmp/home"), path.normalize("/tmp/home"));
});

Deno.test("expand: 相対パスを cwd 基準の絶対パスへ変換する", () => {
  assertEquals(
    expand("foo/bar", "/tmp/home"),
    path.join(Deno.cwd(), "foo", "bar"),
  );
});

Deno.test("expand: 絶対パスは正規化して返す", () => {
  const abs = path.join(Deno.cwd(), "already", "absolute");
  assertEquals(expand(abs, "/tmp/home"), abs);
});

Deno.test("expand: ~ 指定で home が解決できない場合は例外", () => {
  // 空文字を渡して homedir 未解決 (falsy) の状態を再現する。
  // 明示的に undefined を渡すとデフォルト引数 getHomedir() が発動してしまう為。
  assertThrows(
    () => expand("~/foo", ""),
    Error,
    "Cannot find home directory.",
  );
});

// --- parseConfig ---

Deno.test("parseConfig: 正常な設定をパースする", () => {
  const config = parseConfig(`
link:
  ~/.bashrc:
    - src: ./path/to/.bashrc
`);

  assertEquals(Object.keys(config.link), ["~/.bashrc"]);
  assertEquals(config.link["~/.bashrc"][0].src, "./path/to/.bashrc");
});

Deno.test("parseConfig: link が無い設定は例外", () => {
  assertThrows(() => parseConfig("foo: bar"));
});

Deno.test("parseConfig: 未知のプロパティを含む設定は例外", () => {
  assertThrows(() =>
    parseConfig(`
link:
  ~/.x:
    - src: ./x
extra: true
`)
  );
});

Deno.test("parseConfig: permissions を含む設定をパースできる", () => {
  const config = parseConfig(`
link:
  ~/.bashrc:
    - src: ./path/to/.bashrc
permissions:
  - path: ./.ssh
    mode: "700"
  - path: ./.ssh/keys/*
    mode: "600"
`);

  assertEquals(config.permissions?.length, 2);
  assertEquals(config.permissions?.[0].path, "./.ssh");
  assertEquals(config.permissions?.[0].mode, "700");
  assertEquals(config.permissions?.[1].path, "./.ssh/keys/*");
  assertEquals(config.permissions?.[1].mode, "600");
});

Deno.test("parseConfig: permissions が無い設定は undefined (後方互換)", () => {
  const config = parseConfig(`
link:
  ~/.bashrc:
    - src: ./path/to/.bashrc
`);

  assertEquals(config.permissions, undefined);
});

Deno.test("parseConfig: permissions の mode が 8 進数以外は例外", () => {
  assertThrows(() =>
    parseConfig(`
link:
  ~/.bashrc:
    - src: ./path/to/.bashrc
permissions:
  - path: ./.ssh
    mode: "abc"
`)
  );
});

Deno.test("parseConfig: permissions の mode に不正な桁があると例外", () => {
  assertThrows(() =>
    parseConfig(`
link:
  ~/.bashrc:
    - src: ./path/to/.bashrc
permissions:
  - path: ./.ssh
    mode: "799"
`)
  );
});

Deno.test("parseConfig: permissions の mode の桁数が不正だと例外", () => {
  assertThrows(() =>
    parseConfig(`
link:
  ~/.bashrc:
    - src: ./path/to/.bashrc
permissions:
  - path: ./.ssh
    mode: "70"
`)
  );
});

Deno.test("parseConfig: permissions のルールに未知プロパティを含むと例外", () => {
  assertThrows(() =>
    parseConfig(`
link:
  ~/.bashrc:
    - src: ./path/to/.bashrc
permissions:
  - path: ./.ssh
    mode: "700"
    exclude:
      - ./x/y
`)
  );
});

Deno.test("parseConfig: permissions のルールに path が無いと例外", () => {
  assertThrows(() =>
    parseConfig(`
link:
  ~/.bashrc:
    - src: ./path/to/.bashrc
permissions:
  - mode: "700"
`)
  );
});

Deno.test("parseConfig: permissions のルールに mode が無いと例外", () => {
  assertThrows(() =>
    parseConfig(`
link:
  ~/.bashrc:
    - src: ./path/to/.bashrc
permissions:
  - path: ./.ssh
`)
  );
});

Deno.test("parseConfig: permissions の targets 付きルールをパースできる", () => {
  const config = parseConfig(`
link:
  ~/.bashrc:
    - src: ./path/to/.bashrc
permissions:
  - path: ./.ssh/keys/*.pub
    mode: "644"
    targets:
      - linux
`);

  assertEquals(config.permissions?.[0].targets, ["linux"]);
});

Deno.test("parseConfig: permissions の targets に不正な OS 値があると例外", () => {
  assertThrows(() =>
    parseConfig(`
link:
  ~/.bashrc:
    - src: ./path/to/.bashrc
permissions:
  - path: ./.ssh/keys/*.pub
    mode: "644"
    targets:
      - solaris
`)
  );
});

// --- clean ---

Deno.test("clean: シンボリックリンクを削除し、リンク先は残す", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const target = path.join(tmp, "target.txt");
    const linkPath = path.join(tmp, "link.txt");
    await Deno.writeTextFile(target, "x");
    await Deno.symlink(target, linkPath);

    await clean(linkPath);

    assertEquals(await lexists(linkPath), false);
    assertEquals(await lexists(target), true);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("clean: 存在しないパスは何もしない", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    await clean(path.join(tmp, "nope.txt"));
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("clean: シンボリックリンクでない実体がある場合は例外", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const file = path.join(tmp, "real.txt");
    await Deno.writeTextFile(file, "x");

    await assertRejects(() => clean(file), Error, "already exists");
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

// --- link ---

Deno.test("link: 親ディレクトリを作成しシンボリックリンクを生成する", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const src = path.join(tmp, "src.txt");
    const dest = path.join(tmp, "nested", "dest.txt");
    await Deno.writeTextFile(src, "x");

    await link(dest, src);

    assertEquals(await Deno.readLink(dest), src);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("link: src が存在しない場合は例外", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const src = path.join(tmp, "missing.txt");
    const dest = path.join(tmp, "dest.txt");

    await assertRejects(() => link(dest, src), Error, "not exists");
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

// --- applyPermission ---
// 本テストは chmod をサポートする OS (Windows 以外) 上でのみ有効。

Deno.test("applyPermission: glob にマッチする全ファイルへ適用し、マッチパス一覧を返す", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const keysDir = path.join(tmp, "keys");
    await Deno.mkdir(keysDir);
    const fileA = path.join(keysDir, "a");
    const fileB = path.join(keysDir, "b");
    await Deno.writeTextFile(fileA, "x");
    await Deno.writeTextFile(fileB, "x");

    const matched = await applyPermission(path.join(keysDir, "*"), "600");

    assertEquals(matched.sort(), [fileA, fileB].sort());
    assertEquals(((await Deno.stat(fileA)).mode ?? 0) & 0o777, 0o600);
    assertEquals(((await Deno.stat(fileB)).mode ?? 0) & 0o777, 0o600);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("applyPermission: 後勝ちで後のルールが上書きする", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const fileA = path.join(tmp, "a");
    const fileB = path.join(tmp, "b.pub");
    await Deno.writeTextFile(fileA, "x");
    await Deno.writeTextFile(fileB, "x");

    await applyPermission(path.join(tmp, "*"), "600");
    await applyPermission(path.join(tmp, "*.pub"), "644");

    assertEquals(((await Deno.stat(fileA)).mode ?? 0) & 0o777, 0o600);
    assertEquals(((await Deno.stat(fileB)).mode ?? 0) & 0o777, 0o644);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("applyPermission: glob なしのリテラルパスでディレクトリに適用できる", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const dir = path.join(tmp, "dir");
    await Deno.mkdir(dir);

    const matched = await applyPermission(dir, "700");

    assertEquals(matched, [dir]);
    assertEquals(((await Deno.stat(dir)).mode ?? 0) & 0o777, 0o700);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("applyPermission: マッチ 0 件は空配列を返し例外にならない", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const matched = await applyPermission(path.join(tmp, "nope", "*"), "600");

    assertEquals(matched, []);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

// --- isChmodSupported ---

Deno.test("isChmodSupported: windows では false", () => {
  assertEquals(isChmodSupported("windows"), false);
});

Deno.test("isChmodSupported: linux / darwin では true", () => {
  assertEquals(isChmodSupported("linux"), true);
  assertEquals(isChmodSupported("darwin"), true);
});
