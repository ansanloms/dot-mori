import dir from "./deps/dir/mod.ts";
import * as fs from "./deps/@std/fs/mod.ts";
import * as path from "./deps/@std/path/mod.ts";
import * as yaml from "./deps/@std/yaml/mod.ts";

import { FromSchema } from "./deps/json-schema-to-ts/mod.ts";
import Ajv from "./deps/ajv/mod.ts";

import Schema from "./schemas/Schema.json" with { type: "json" };

const SchemaEnumOs = {
  ...Schema.definitions.EnumOs,
  definitions: Schema.definitions,
} as const;
const SchemaLink = {
  ...Schema.definitions.Link,
  definitions: Schema.definitions,
} as const;
const SchemaConfig = {
  ...Schema.definitions.Config,
  definitions: Schema.definitions,
} as const;

type EnumOs = FromSchema<typeof SchemaEnumOs>;
type Link = FromSchema<typeof SchemaLink>;
type Config = FromSchema<typeof SchemaConfig>;

const homedir = dir("home") ?? undefined;

const ajv = new Ajv();

function assertConfig(x: unknown): asserts x is Config {
  const validate = ajv.compile(SchemaConfig);
  const valid = validate(x);
  if (!valid) {
    throw new Error(validate.errors.map((error) => error.message).join("; "));
  }
}

export const getConfig = async (configPath: string) => {
  const config = yaml.parse(await Deno.readTextFile(configPath));
  assertConfig(config);

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
    throw new Error("'" + src + "' not exists.");
  }

  await Deno.mkdir(path.dirname(expandDest), { recursive: true });
  await Deno.symlink(expandSrc, expandDest, {
    type: (await Deno.stat(expandSrc)).isDirectory ? "dir" : "file",
  });
};
