const fs = require('fs');
const { resolve, join } = require('path');

const webpack = require('webpack');

const VirtualFoldersPlugin = require('../index');
const config = require('./webpack.config');

(() => {
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
    console.log('Done!', err)
  });
})();
