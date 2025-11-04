import dir from "./deps/dir/mod.ts";
import * as fs from "./deps/@std/fs/mod.ts";
import * as path from "./deps/@std/path/mod.ts";
import * as yaml from "./deps/@std/yaml/mod.ts";

import { FromSchema } from "./deps/json-schema-to-ts/mod.ts";
import Ajv from "./deps/ajv/mod.ts";

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
  },
} as const;

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

export const getConfig = async (configPath: string): Promise<Config> => {
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
    throw new Error(`'${src}' not exists.`);
  }

  await Deno.mkdir(path.dirname(expandDest), { recursive: true });
  await Deno.symlink(expandSrc, expandDest, {
    type: (await Deno.stat(expandSrc)).isDirectory ? "dir" : "file",
  });
};
