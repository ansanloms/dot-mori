import { Command } from "./deps/@cliffy/command/mod.ts";
import { colors } from "./deps/@cliffy/ansi/colors.ts";
import * as dotMori from "./mod.ts";

const { options } = await new Command()
  .version("0.1.2")
  .description("A tool for managing and installing dotfiles.")
  .option("--config <config:string>", "config path.", { required: true })
  .option("--clean", "remove dotfile symlinks.", { default: false })
  .parse(Deno.args);

const config = await dotMori.getConfig(options.config);

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
        ` ${colors.gray("Remove:")} ${colors.cyan(dest)}${colors.gray(".")}`,
      );
      await dotMori.clean(dest);

      if (!options.clean) {
        console.info(
          ` ${colors.gray("Create:")} ${colors.cyan(dest)} ${
            colors.gray("->")
          } ${colors.cyan(src)}${colors.gray(".")}`,
        );
        await dotMori.link(dest, src);
      }

      console.info(` ${colors.green("Successed.")}`);
    } catch (error) {
      console.error(` ${colors.red(error.toString())}`);
      isError = true;
    }
  }
}

Deno.exit(isError ? 1 : 0);
