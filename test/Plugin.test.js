const path = require('path');
const webpack = require('webpack');
const config = require('./webpack.config')

test('Plugin test', (next) => {

  webpack(config).run(function(err, stats) {
    expect(err).toBe(null);
    const fs = stats.compilation.inputFileSystem;
    const actual = fs.readFileSync(path.resolve('test/public/index.bundle.js')).toString();
    [
      './node_modules/react/index.js',
      './test/env/src/another.js',
      './test/env/src/another.js',
      './test/env/src/assets/number-one.js',
      './test/env/src/index.js',
      './test/env/src/module/category/components/CategoryItem.jsx',
      './test/env/src/module/category/components/CategoryList.jsx',
      './test/env/src/module/category/components/index.js',
      './test/env/src/module/category/index.js',
      './test/env/src/module/product.js',
      './test/env/src/module/product/components.js',
      './test/env/src/module/product/components/ProductItem.jsx',
      './test/env/src/module/product/components/ProductList.jsx',
    ].forEach(file => {
      expect(actual.indexOf(file) !== -1).toBe(true)
    })
    next();
  });
})
