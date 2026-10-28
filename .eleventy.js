module.exports = function (eleventyConfig) {
  // The base layout links styles.css; generate it from the Tailwind source.
  eleventyConfig.on("eleventy.before", async () => {
    const fs = require("node:fs/promises");
    const from = "src/assets/css/style.css";
    const to = "dist/assets/css/styles.css";
    const result = await require("postcss")([require("@tailwindcss/postcss")()])
      .process(await fs.readFile(from, "utf8"), { from, to });
    await fs.mkdir("dist/assets/css", { recursive: true });
    await fs.writeFile(to, result.css);
  });

  eleventyConfig.addPassthroughCopy({
    "src/assets": "assets"
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "dist"
    },

    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk"
  };
};
