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

    type Result =
      | { dest: string; src: string; status: "success" }
      | { dest: string; src: string; status: "skipped" }
      | { dest: string; src: string; status: "failed"; error: string };

    const results: Result[] = [];

    for (const [dest, linkItems] of Object.entries(config.link)) {
      for (const { src, targets } of linkItems) {
        console.info();
        console.info(
          `${colors.blue(dest)} ${colors.gray("->")} ${colors.yellow(src)}`,
        );

        if (
          typeof targets !== "undefined" &&
          !targets.map(String).includes(String(Deno.build.os))
        ) {
          console.info(
            ` ${colors.gray("Skipped:")} not target os (${Deno.build.os}).`,
          );
          results.push({ dest, src, status: "skipped" });
          continue;
        }

        try {
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
          results.push({ dest, src, status: "success" });
        } catch (error) {
          console.error(` ${colors.red(String(error))}`);
          results.push({ dest, src, status: "failed", error: String(error) });
        }
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const failed = results.filter((r) => r.status === "failed");

    console.info();
    console.info(colors.gray("========== Summary =========="));
    console.info(`  ${colors.green("Success:")} ${successCount}`);
    console.info(`  ${colors.gray("Skipped:")} ${skippedCount}`);
    console.info(
      `  ${
        (failed.length > 0 ? colors.red : colors.gray)("Failed:")
      }  ${failed.length}`,
    );

    if (failed.length > 0) {
      console.error();
      console.error(colors.red("Failed:"));
      for (const { dest, src, error } of failed) {
        console.error(`  ${dest} ${colors.gray("->")} ${src}`);
        console.error(`    ${colors.red(error)}`);
      }
    }

    Deno.exit(failed.length > 0 ? 1 : 0);
  },
});

await cli(Deno.args, command, {
  name: "dot-mori",
  version: DenoJson.version,
});
