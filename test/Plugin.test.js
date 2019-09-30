const fs = require('fs');
const { resolve, join } = require('path');

const webpack = require('webpack');

const VirtualFoldersPlugin = require('../index');
const config = require('./webpack.config');

test('Basic test', (next) => {
  config.entry = {
    env1: './test/env/src/index.js'
  };

  config.plugins = [
    new webpack.ProvidePlugin({
      React: 'react'
    }),
    new VirtualFoldersPlugin({
      folders: {
        'test/env/src/module/product': resolve(__dirname, 'env/module/product')
      },
      files: {
        'test/env/src/assets/number-one.js': 'module.exports = 1'
      }
    })
  ];

  webpack(config).run(function(err, stats) {
    expect(err).toBe(null);
    const fs = stats.compilation.inputFileSystem;
    const actual = fs.readFileSync(resolve('test/public/env1.bundle.js')).toString();
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

test('Code splitting test', (next) => {
  const components = {
    Link: resolve(__dirname, 'env2/components/Link.jsx')
  };

  const pages = {
    '/home': {
      route: '/',
      view: resolve(__dirname, 'env2/pages/home.jsx')
    },
    '/product': {
      route: '/product/:id',
      view: resolve(__dirname, 'env2/pages/product.jsx')
    }
  };

  const context = './test/env2/client';
  const modules = {};

  //generate a routes file
  (() => {
    const routes = {};
    Object.keys(pages).forEach(path => {
      //determine the target file path (virtual pathing)
      const target = './' + join(context, 'pages', path + '.jsx');
      //add the target/view to the virtual modules
      modules[target] = fs.readFileSync(pages[path].view);
      //add route/view to the browser route
      routes[pages[path].route] = path;
    });

    const target = 'node_modules/foo_module/routes.js';
    const source = 'module.exports = ' + JSON.stringify(routes, null, 2);
    modules[target] = source;
  })();

  //generate a components file
  (() => {
    const target = 'node_modules/foo_module/components.js';
    const source = [];
    const names = Object.keys(components);
    names.forEach(name => {
      const target = 'node_modules/foo_module/components/' + name + '.jsx';
      modules[target] = fs.readFileSync(components[name]);
      source.push(`import ${name} from './components/${name}.jsx';`);
    });

    source.push(`export { ${names.join(', ')} };`);
    modules[target] = source.join("\n");
  })();

  config.entry = { env2: './test/env2/client/index.js' };
  config.plugins = [
    new VirtualFoldersPlugin({ files: modules })
  ];

  webpack(config).run(function(err, stats) {
    expect(err).toBe(null);
    const fs = stats.compilation.inputFileSystem;
    const actual = fs.readFileSync(resolve('test/public/env2.bundle.js')).toString();
    [
      './node_modules/foo_module/routes.js',
      './node_modules/foo_module/components.js',
      './node_modules/foo_module/components/Link.jsx',
      './test/env2/client/index.js'
    ].forEach(file => {
      expect(actual.indexOf(file) !== -1).toBe(true)
    })

    const actual0 = fs.readFileSync(resolve('test/public/0.bundle.js')).toString();
    [
      './test/env2/client/pages/home.jsx'
    ].forEach(file => {
      expect(actual0.indexOf(file) !== -1).toBe(true)
    })

    const actual1 = fs.readFileSync(resolve('test/public/1.bundle.js')).toString();
    [
      './test/env2/client/pages/product.jsx'
    ].forEach(file => {
      expect(actual1.indexOf(file) !== -1).toBe(true)
    })
    next();
  });
})
