module.exports = function (eleventyConfig) {

  eleventyConfig.addPassthroughCopy({
    "src/assets": "assets"
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site"
    },

    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk"
  };
};
