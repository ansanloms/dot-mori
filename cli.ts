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
      | {
        kind: "link";
        dest: string;
        src: string;
        status: "success" | "skipped";
      }
      | {
        kind: "link";
        dest: string;
        src: string;
        status: "failed";
        error: string;
      }
      | {
        kind: "permission";
        path: string;
        mode: string;
        status: "success" | "skipped";
      }
      | {
        kind: "permission";
        path: string;
        mode: string;
        status: "failed";
        error: string;
      };

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
          results.push({ kind: "link", dest, src, status: "skipped" });
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
          results.push({ kind: "link", dest, src, status: "success" });
        } catch (error) {
          console.error(` ${colors.red(String(error))}`);
          results.push({
            kind: "link",
            dest,
            src,
            status: "failed",
            error: String(error),
          });
        }
      }
    }

    const permissionItems = config.permissions ?? [];

    if (!ctx.values.clean && permissionItems.length > 0) {
      if (!dotMori.isChmodSupported()) {
        console.info();
        console.info(
          colors.gray(
            `Permissions: chmod is not supported on ${Deno.build.os}. Skipped.`,
          ),
        );
        for (const { path: targetPath, mode } of permissionItems) {
          results.push({
            kind: "permission",
            path: targetPath,
            mode,
            status: "skipped",
          });
        }
      } else {
        for (const { path: targetPath, mode, targets } of permissionItems) {
          console.info();
          console.info(
            `${colors.blue(targetPath)} ${colors.gray("mode")} ${
              colors.yellow(mode)
            }`,
          );

          if (
            typeof targets !== "undefined" &&
            !targets.map(String).includes(String(Deno.build.os))
          ) {
            console.info(
              ` ${colors.gray("Skipped:")} not target os (${Deno.build.os}).`,
            );
            results.push({
              kind: "permission",
              path: targetPath,
              mode,
              status: "skipped",
            });
            continue;
          }

          try {
            const matched = await dotMori.applyPermission(targetPath, mode);

            if (matched.length === 0) {
              console.info(` ${colors.gray("Skipped:")} no path matched.`);
              results.push({
                kind: "permission",
                path: targetPath,
                mode,
                status: "skipped",
              });
              continue;
            }

            console.info(
              ` ${colors.gray("Chmod:")} ${
                colors.cyan(String(matched.length))
              } ${colors.gray("path(s).")}`,
            );
            console.info(` ${colors.green("Successed.")}`);
            results.push({
              kind: "permission",
              path: targetPath,
              mode,
              status: "success",
            });
          } catch (error) {
            console.error(` ${colors.red(String(error))}`);
            results.push({
              kind: "permission",
              path: targetPath,
              mode,
              status: "failed",
              error: String(error),
            });
          }
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
      for (const result of failed) {
        if (result.kind === "link") {
          console.error(`  ${result.dest} ${colors.gray("->")} ${result.src}`);
        } else {
          console.error(
            `  ${result.path} ${colors.gray("mode")} ${result.mode}`,
          );
        }
        console.error(`    ${colors.red(result.error)}`);
      }
    }

    Deno.exit(failed.length > 0 ? 1 : 0);
  },
});

await cli(Deno.args, command, {
  name: "dot-mori",
  version: DenoJson.version,
});
