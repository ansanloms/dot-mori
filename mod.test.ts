import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "./deps/@std/assert/mod.ts";
import * as path from "./deps/@std/path/mod.ts";

import { clean, expand, link, parseConfig } from "./mod.ts";

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
  const config = parseConfig(
    [
      "link:",
      "  ~/.bashrc:",
      "    - src: ./path/to/.bashrc",
    ].join("\n"),
  );

  assertEquals(Object.keys(config.link), ["~/.bashrc"]);
  assertEquals(config.link["~/.bashrc"][0].src, "./path/to/.bashrc");
});

Deno.test("parseConfig: link が無い設定は例外", () => {
  assertThrows(() => parseConfig("foo: bar"));
});

Deno.test("parseConfig: 未知のプロパティを含む設定は例外", () => {
  assertThrows(() =>
    parseConfig(
      ["link:", "  ~/.x:", "    - src: ./x", "extra: true"].join("\n"),
    )
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
