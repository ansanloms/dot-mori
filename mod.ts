import { as, assert, is } from "./deps/@core/unknownutil/mod.ts";
import type { Predicate } from "./deps/@core/unknownutil/mod.ts";
import { Command } from "./deps/@cliffy/command/mod.ts";
import { colors } from "./deps/@cliffy/ansi/colors.ts";
import dir from "./deps/dir/mod.ts";
import * as fs from "./deps/@std/fs/mod.ts";
import * as path from "./deps/@std/path/mod.ts";
import * as yaml from "./deps/@std/yaml/mod.ts";

const homedir = dir("home");

type Link = {
  /**
   * src file path
   */
  src: string;

  /**
   * target os
   */
  targets?: ("darwin" | "linux" | "windows")[];
};

type Config = {
  /**
   * install link list
   */
  link: Record<string, Link[]>;
};

const isTarget = is.UnionOf([
  is.LiteralOf("darwin"),
  is.LiteralOf("linux"),
  is.LiteralOf("windows"),
]);

const isLink = is.ObjectOf({
  src: is.String,
  targets: as.Optional(is.ArrayOf(isTarget)),
}) satisfies Predicate<Link>;

const isConfig = is.ObjectOf({
  link: is.RecordOf(is.ArrayOf(isLink), is.String),
}) satisfies Predicate<Config>;

const getConfig = async (configPath: string) => {
  const config = yaml.parse(await Deno.readTextFile(configPath));
  assert<Config>(config, isConfig);

  return config;
};

const expand = (filepath: string) => {
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

const clean = async (dest: string) => {
  const expandDest = expand(dest);

  if (!(await fs.exists(expandDest))) {
    return;
  }

  if ((await Deno.readLink(expandDest).catch(() => null)) === null) {
    throw new Error("'" + dest + "' already exists.");
  }

  await Deno.remove(expandDest);
};

const link = async (dest: string, src: string) => {
  const expandSrc = expand(src);
  const expandDest = expand(dest);

  if (!(await fs.exists(expandSrc))) {
    throw new Error("'" + src + "' not exists.");
  }

  await Deno.mkdir(path.dirname(expandDest), { recursive: true });
  await Deno.symlink(expandSrc, expandDest, {
    type: (await Deno.stat(expandSrc)).isDirectory ? "dir" : "file",
  });
};

export const cli = async (args: string[]) => {
  const { options } = await new Command()
    .option("--config <config:string>", "config path.", { required: true })
    .option("--clean", "remove dotfile symlinks.", { default: false })
    .parse(args);

  const config = await getConfig(options.config);

  for (const [dest, linkItems] of Object.entries(config.link)) {
    for (const { src, targets } of linkItems) {
      if (
        typeof targets !== "undefined" &&
        !targets.map(String).includes(String(Deno.build.os))
      ) {
        continue;
      }

      try {
        console.info();
        console.info(
          `${colors.blue(dest)} ${colors.gray("->")} ${colors.yellow(src)}`,
        );

        console.info(
          ` ${colors.gray("Remove:")} ${colors.cyan(dest)}${colors.gray(".")}`,
        );
        await clean(dest);

        if (!options.clean) {
          console.info(
            ` ${colors.gray("Create:")} ${colors.cyan(dest)} ${
              colors.gray("->")
            } ${colors.cyan(src)}${colors.gray(".")}`,
          );
          await link(dest, src);
        }

        console.info(` ${colors.green("Successed.")}`);
      } catch (error) {
        console.error(` ${colors.red(error.toString())}`);
      }
    }
  }
};
