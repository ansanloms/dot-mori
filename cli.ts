import { cli, define } from "./deps/@gunshi/gunshi/mod.ts";
import * as colors from "./deps/@std/fmt/colors.ts";
import DenoJson from "./deno.json" with { type: "json" };
import * as dotMori from "./mod.ts";

const command = define({
  name: "dot-mori",
  description: "A tool for managing and installing dotfiles.",
  args: {
    config: {
      type: "string",
      description: "config path.",
      required: true,
    },
    clean: {
      type: "boolean",
      description: "remove dotfile symlinks.",
      default: false,
    },
  },
  run: async (ctx) => {
    const config = await dotMori.getConfig(ctx.values.config);

    let isError: boolean = false;

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
            ` ${colors.gray("Remove:")} ${colors.cyan(dest)}${
              colors.gray(".")
            }`,
          );
          await dotMori.clean(dest);

          if (!ctx.values.clean) {
            console.info(
              ` ${colors.gray("Create:")} ${colors.cyan(dest)} ${
                colors.gray("->")
              } ${colors.cyan(src)}${colors.gray(".")}`,
            );
            await dotMori.link(dest, src);
          }

          console.info(` ${colors.green("Successed.")}`);
        } catch (error) {
          console.error(` ${colors.red(String(error))}`);
          isError = true;
        }
      }
    }

    Deno.exit(isError ? 1 : 0);
  },
});

await cli(Deno.args, command, {
  name: "dot-mori",
  version: DenoJson.version,
});
