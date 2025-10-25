const path = require('path');
module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      webpackConfig.module.rules.push(
        // Shader files as raw text
        {
          test: /\.wgsl$/,
          type: 'asset/source'
        }
        // ,
        // // Video files as URLs
        // {
        //   test: /\.(mp4|webm|ogg)$/,
        //   type: 'asset/resource'
        // }
      );
      
      
      return webpackConfig;
    }
  },
};
